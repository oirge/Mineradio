'use strict';
/**
 * Mineradio 壁纸画面的唯一实现。桌面壁纸层覆盖窗口和播放器内背景板共用本模块，
 * 保证两种展示位置的画面、调度节奏和关闭态资源释放完全一致。
 */
(function(global){
  var WALLPAPER_IDLE_FPS = 30;
  var WALLPAPER_DISABLED_DELAY = 1000;
  var DEFAULT_COLORS = { primary:'#d6f8ff', secondary:'#9cffdf', highlight:'#fff0b8', glow:'#9cffdf' };
  /**
   * 把十六进制颜色转成 RGB 分量，非法值回落到给定兜底色。
   * @param {string} hex 颜色值。
   * @param {string=} fallback 兜底颜色。
   * @returns {{r:number,g:number,b:number}} RGB 分量。
   */
  function hexToRgb(hex, fallback){
    hex = String(hex || fallback || '#9cffdf').trim();
    if (/^#[0-9a-f]{3}$/i.test(hex)) hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    if (!/^#[0-9a-f]{6}$/i.test(hex)) hex = fallback || '#9cffdf';
    return { r:parseInt(hex.slice(1,3),16), g:parseInt(hex.slice(3,5),16), b:parseInt(hex.slice(5,7),16) };
  }
  /**
   * 生成带透明度的 rgba 字符串。
   * @param {string} hex 颜色值。
   * @param {number} a 透明度。
   * @returns {string} rgba 颜色。
   */
  function rgba(hex, a){
    var c = hexToRgb(hex);
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')';
  }
  /**
   * 用固定种子生成稳定伪随机数，保证粒子分布每次一致。
   * @param {number} seed 粒子种子。
   * @returns {number} `0 ~ 1` 伪随机值。
   */
  function rand(seed){ return Math.abs(Math.sin(seed * 3187.917) * 43758.5453) % 1; }
  /**
   * 在给定画布上创建一个壁纸画面实例。画布必须铺满视口，画面按视口尺寸绘制。
   * @param {HTMLCanvasElement} canvas 目标画布。
   * @returns {{applyState:Function,setPaused:Function,dispose:Function}} 壁纸实例。
   */
  function createMineradioWallpaperEffect(canvas){
    var ctx = canvas.getContext('2d', { alpha:false });
    var W = 1, H = 1, dpr = 1;
    var state = {
      enabled:false,title:'Mineradio',artist:'',cover:'',playing:false,preset:0,opacity:1,
      colors:Object.assign({}, DEFAULT_COLORS)
    };
    var coverImg = null, coverSrc = '';
    var particles = [];
    var overlayRenderPaused = document.hidden === true;
    var wallpaperDrawHandle = 0;
    var wallpaperDrawKind = '';
    var disposed = false;
    /**
     * 按视口面积补齐粒子，保证密度随分辨率自适应。
     * @returns {void}
     */
    function ensureParticles(){
      var target = Math.min(760, Math.max(420, Math.round((innerWidth * innerHeight) / 4200)));
      while (particles.length < target) {
        var i = particles.length + 1;
        particles.push({ seed:i * 11.37, x:rand(i), y:rand(i * 2.7), lane:rand(i * 5.9), z:rand(i * 8.1), size:.6 + rand(i * 4.2) * 2.4 });
      }
      if (particles.length > target + 80) particles.length = target;
    }
    /**
     * 同步画布像素尺寸与设备像素比。
     * @returns {void}
     */
    function resize(){
      dpr = Math.min(1.35, Math.max(1, window.devicePixelRatio || 1));
      W = Math.max(1, Math.floor(innerWidth * dpr));
      H = Math.max(1, Math.floor(innerHeight * dpr));
      canvas.width = W; canvas.height = H;
      canvas.style.width = innerWidth + 'px';
      canvas.style.height = innerHeight + 'px';
      ctx.setTransform(dpr,0,0,dpr,0,0);
      ensureParticles();
    }
    /**
     * 载入封面图，重复地址不重新解码。
     * @param {string} src 封面地址。
     * @returns {void}
     */
    function setCover(src){
      src = String(src || '');
      if (src === coverSrc) return;
      coverSrc = src;
      coverImg = null;
      if (!src) return;
      var img = new Image();
      img.onload = function(){ if (coverSrc === src) coverImg = img; };
      img.onerror = function(){ if (coverSrc === src) coverImg = null; };
      img.src = src;
    }
    /**
     * 合并新的壁纸状态并重排下一帧。
     * @param {object} next 壁纸状态增量。
     * @returns {void}
     */
    function applyState(next){
      if (disposed) return;
      next = next || {};
      state = Object.assign({}, state, next || {});
      state.colors = Object.assign({}, state.colors, next && next.colors || {});
      if (!state.enabled) {
        // 关闭状态不再需要封面解码对象和粒子数组，避免覆盖层关闭前继续保留大对象。
        state.cover = '';
        particles.length = 0;
      }
      setCover(state.cover || '');
      cancelScheduledDraw();
      scheduleNextDraw();
    }
    /**
     * 绘制居中封面的模糊光晕与本体。
     * @param {number} now 秒级时间戳。
     * @returns {void}
     */
    function drawCover(now){
      if (!coverImg) return;
      var side = Math.min(innerWidth, innerHeight) * (.42 + Math.sin(now * .21) * .012);
      var x = innerWidth * .5 - side * .5;
      var y = innerHeight * .50 - side * .5 + Math.sin(now * .37) * 8;
      ctx.save();
      ctx.globalAlpha = .16 * (state.opacity || 1);
      ctx.filter = 'blur(28px) saturate(1.25)';
      ctx.drawImage(coverImg, x - side * .12, y - side * .12, side * 1.24, side * 1.24);
      ctx.filter = 'none';
      ctx.globalAlpha = .20 * (state.opacity || 1);
      ctx.drawImage(coverImg, x, y, side, side);
      ctx.restore();
    }
    /**
     * 取消已排队的绘制句柄，避免 RAF 与定时器并存。
     * @returns {void}
     */
    function cancelScheduledDraw(){
      if (!wallpaperDrawHandle) return;
      if (wallpaperDrawKind === 'timeout') clearTimeout(wallpaperDrawHandle);
      else cancelAnimationFrame(wallpaperDrawHandle);
      wallpaperDrawHandle = 0;
      wallpaperDrawKind = '';
    }
    /**
     * 播放中用 RAF，空闲限频 30 FPS，关闭后降到 1 秒低频调度。
     * @returns {void}
     */
    function scheduleNextDraw(){
      if (disposed || overlayRenderPaused || wallpaperDrawHandle) return;
      if (state.enabled && state.playing) {
        wallpaperDrawKind = 'raf';
        wallpaperDrawHandle = requestAnimationFrame(function(nowMs){
          wallpaperDrawHandle = 0;
          wallpaperDrawKind = '';
          draw(nowMs);
        });
        return;
      }
      wallpaperDrawKind = 'timeout';
      wallpaperDrawHandle = setTimeout(function(){
        wallpaperDrawHandle = 0;
        wallpaperDrawKind = '';
        draw(performance.now());
      }, state.enabled ? Math.max(16, Math.round(1000 / WALLPAPER_IDLE_FPS)) : WALLPAPER_DISABLED_DELAY);
    }
    /**
     * 绘制一帧壁纸画面。
     * @param {number} nowMs 毫秒时间戳。
     * @returns {void}
     */
    function draw(nowMs){
      if (overlayRenderPaused) return;
      if (!state.enabled) {
        if (canvas.width && canvas.height) ctx.clearRect(0, 0, innerWidth, innerHeight);
        scheduleNextDraw();
        return;
      }
      var now = nowMs * .001;
      ensureParticles();
      var opacity = Math.max(.35, Math.min(1, state.opacity || 1));
      var primary = state.colors.primary || '#d6f8ff';
      var secondary = state.colors.secondary || '#9cffdf';
      var highlight = state.colors.highlight || '#fff0b8';
      var glow = state.colors.glow || secondary;
      var bg = ctx.createLinearGradient(0,0,innerWidth,innerHeight);
      bg.addColorStop(0, '#050608');
      bg.addColorStop(.52, rgba(primary, .12 * opacity));
      bg.addColorStop(1, rgba(secondary, .10 * opacity));
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.fillStyle = bg;
      ctx.fillRect(0,0,innerWidth,innerHeight);
      drawCover(now);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      var cx = innerWidth * .5;
      var cy = innerHeight * .5 + Math.sin(now * .28) * innerHeight * .018;
      var rx = innerWidth * .40;
      var ry = innerHeight * .30;
      for (var i=0;i<particles.length;i++) {
        var p = particles[i];
        var speed = .009 + rand(p.seed) * .021 + (state.playing ? .010 : 0);
        var a = (p.x * Math.PI * 2 + now * speed + Math.sin(now * .07 + p.seed) * .14) % (Math.PI * 2);
        var ring = .18 + p.z * .82;
        var wobble = Math.sin(now * (.22 + rand(p.seed) * .18) + p.seed) * 12;
        var x = cx + Math.cos(a) * rx * ring + Math.sin(now * .11 + p.seed) * 24;
        var y = cy + Math.sin(a * (1.0 + rand(p.seed * 2) * .16)) * ry * ring + wobble;
        var tw = Math.pow(.5 + .5 * Math.sin(now * (.50 + rand(p.seed)*.42) + p.seed), 4);
        var r = Math.max(.7, p.size * (.8 + tw * 1.2));
        var col = tw > .74 ? highlight : (p.lane > .55 ? secondary : glow);
        ctx.globalAlpha = (0.045 + tw * .18 + (state.playing ? .035 : 0)) * opacity;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(x,y,r,0,Math.PI*2);
        ctx.fill();
      }
      var aura = ctx.createRadialGradient(cx,cy,0,cx,cy,Math.max(innerWidth,innerHeight)*.54);
      aura.addColorStop(0, rgba(highlight, .12 * opacity));
      aura.addColorStop(.34, rgba(secondary, .08 * opacity));
      aura.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = .9;
      ctx.fillStyle = aura;
      ctx.fillRect(0,0,innerWidth,innerHeight);
      ctx.restore();
      scheduleNextDraw();
    }
    /**
     * 暂停或恢复绘制。窗口隐藏、播放器进入深度后台时暂停。
     * @param {boolean} paused 是否暂停。
     * @returns {void}
     */
    function setOverlayRenderPaused(paused){
      paused = !!paused;
      if (overlayRenderPaused === paused) return;
      overlayRenderPaused = paused;
      cancelScheduledDraw();
      if (!paused) scheduleNextDraw();
    }
    /**
     * 跟随文档可见性同步暂停状态。
     * @returns {void}
     */
    function handleVisibilityChange(){
      setOverlayRenderPaused(document.hidden);
    }
    /**
     * 释放画面实例：注销监听、取消调度并丢弃封面与粒子。
     * @returns {void}
     */
    function dispose(){
      if (disposed) return;
      disposed = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('resize', resize);
      cancelScheduledDraw();
      state.enabled = false;
      state.cover = '';
      coverSrc = '';
      coverImg = null;
      particles.length = 0;
      if (canvas.width && canvas.height) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('resize', resize);
    resize();
    scheduleNextDraw();
    return {
      applyState: applyState,
      setPaused: setOverlayRenderPaused,
      dispose: dispose
    };
  }

  global.createMineradioWallpaperEffect = createMineradioWallpaperEffect;
})(typeof window !== 'undefined' ? window : this);
