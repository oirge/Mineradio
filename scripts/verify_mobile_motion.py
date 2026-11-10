"""Cloud-only motion checks using real touch input and bounded, read-only traces."""
import io
import json
import math
import struct
import time
import wave
from contextlib import contextmanager


# A panel intentionally occludes only transport and metadata. Menus keep them
# visible, and an exiting aside retains this exact occlusion contract until unmount.
FOLIA_CHROME_READINESS = r"""
    const chromeReadiness = () => {
        const player = doc.querySelector('[data-testid="local-player"]');
        const panelPresence = player ? [...player.children].filter(element =>
            element.matches('.local-library[data-mobile-motion-presence],.local-settings[data-mobile-motion-presence],'
                + '.local-playback-settings[data-mobile-motion-presence],.local-tool-panel[data-mobile-motion-presence]'))
            .map(element => ({classes: element.className, testid: element.getAttribute('data-testid'),
                presence: element.getAttribute('data-mobile-motion-presence')})) : [];
        const panelOpen = player?.getAttribute('data-panel') === 'open';
        const focus = player?.getAttribute('data-mobile-focus') === 'true'
            || !!player?.classList.contains('local-player-focus');
        const frameBounds = frame.getBoundingClientRect();
        const compactLandscape = view.matchMedia('(max-height:500px) and (orientation:landscape)').matches;
        const selectors = ['.local-mobile-header','.local-mobile-nav','.local-controls','.local-current-track'];
        const surfaces = selectors.map(selector => {
            const element = doc.querySelector(selector);
            const expectedResponsiveHidden = compactLandscape && selector === '.local-current-track';
            const expectedOccluded = panelPresence.length > 0
                && (selector === '.local-controls' || selector === '.local-current-track');
            if (!element) return {selector, expectedOccluded, expectedResponsiveHidden, missing: true, ready: false};
            const style = view.getComputedStyle(element), bounds = element.getBoundingClientRect();
            const point = {x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2};
            const hit = bounds.width > 0 && bounds.height > 0 ? doc.elementFromPoint(point.x, point.y) : null;
            const hostPoint = {x: frameBounds.left + point.x, y: frameBounds.top + point.y};
            const hostHit = bounds.width > 0 && bounds.height > 0
                ? document.elementFromPoint(hostPoint.x, hostPoint.y) : null;
            const frameHitTarget = !!(hit && (hit === element || element.contains(hit)));
            const hitTarget = frameHitTarget && hostHit === frame;
            const fixedNavigation = selector === '.local-mobile-header' || selector === '.local-mobile-nav';
            const visibleReady = style.display !== 'none' && style.visibility === 'visible' && Number(style.opacity) > .9
                && bounds.width > 0 && bounds.height > 0 && !element.closest('[inert]')
                && (!fixedNavigation || style.pointerEvents !== 'none' && hitTarget);
            const occludedReady = expectedOccluded && style.display !== 'none'
                && bounds.width > 0 && bounds.height > 0 && Number(style.opacity) <= .01 && style.visibility === 'hidden'
                && style.pointerEvents === 'none' && !frameHitTarget;
            // The existing compact landscape layout deliberately omits metadata.
            // No other surface or viewport may bypass visibility and hit testing.
            const responsiveHiddenReady = expectedResponsiveHidden && style.display === 'none'
                && bounds.width === 0 && bounds.height === 0 && !frameHitTarget && !hitTarget;
            const ready = expectedResponsiveHidden ? responsiveHiddenReady : expectedOccluded ? occludedReady : visibleReady;
            return {selector, tag: element.tagName, classes: element.getAttribute('class'),
                testid: element.getAttribute('data-testid'), bounds: bounds.toJSON(),
                display: style.display, opacity: Number(style.opacity), visibility: style.visibility,
                pointerEvents: style.pointerEvents, transform: style.transform, transition: style.transition,
                expectedOccluded, expectedResponsiveHidden, occludedReady, responsiveHiddenReady,
                visibleReady, ready, point, hostPoint, frameHitTarget, hitTarget,
                frameHit: hit && {tag: hit.tagName, testid: hit.getAttribute('data-testid'), classes: hit.getAttribute('class')},
                hostHit: hostHit && {tag: hostHit.tagName, id: hostHit.id}};
        });
        const hidden = doc.body.classList.contains('mineradio-mobile-chrome-hidden');
        return {at: view.performance.now(), hostAt: performance.now(), hidden, focus, panelOpen,
            panelPresence, compactLandscape, surfaces,
            ready: !hidden && !focus && doc.querySelectorAll('[data-testid="local-mobile-nav"]').length === 1
                && surfaces.every(surface => surface.ready)};
    };
"""


# Observe UI transitions only. Playback progress, the playing visualizer and
# lyric timelines deliberately continue during these checks.
UI_ANIMATIONS = r"""
    const playbackProgressTransition = animation =>
        animation.effect?.target?.matches?.('#bottom-bar #progress-fill')
            && animation.transitionProperty === 'width';
    const uiAnimations = (animations = doc.getAnimations()) => animations.filter(animation => {
        const target = animation.effect?.target;
        const end = animation.effect?.getComputedTiming?.().endTime;
        if (!target?.matches || !Number.isFinite(end)) return false;
        // The progress fill follows the audio clock; only its width transition
        // is outside UI lifecycle readiness. Its other animations still count.
        if (playbackProgressTransition(animation)) return false;
        return animation.id === 'mineradio-mobile-chrome-stage'
            || target.matches('.local-visualizer,.local-record-wall,.lattice-root,[data-mobile-motion-view]')
            || !!target.closest('#mobile-nav,#playlist-panel,#fx-panel,#search-results,#empty-home,#bottom-bar,#collect-modal,#toast,'
                + '.local-mobile-navigation,.local-controls,.local-current-track,.local-exit-focus,'
                + '[data-mobile-motion-presence],.local-library,.local-settings,'
                + '.local-playback-settings,.local-tool-panel,.local-mobile-more,.local-playlist-menu,.local-slot-menu,'
                + '.local-status-toast,.local-error,.mobile-row-leaving');
    });
"""

SNAPSHOT = r"""
    const describe = element => {
        const style = view.getComputedStyle(element), rect = element.getBoundingClientRect();
        return {nodeId: view.__mineradioMotionAudit?.identify?.(element) ?? null,
            tag: element.tagName, testid: element.getAttribute('data-testid'), classes: element.className,
            opacity: Number(style.opacity), visibility: style.visibility, display: style.display,
            pointerEvents: style.pointerEvents, transform: style.transform, translate: style.translate,
            scale: style.scale, inert: !!element.closest('[inert]'),
            ariaHidden: !!element.closest('[aria-hidden="true"]'),
            mobileFocus: element.getAttribute('data-mobile-focus'), expanded: element.getAttribute('aria-expanded'),
            morePhase: element.getAttribute('data-mobile-motion-more'),
            queueIndex: element.hasAttribute('data-queue-index') ? Number(element.getAttribute('data-queue-index')) : null,
            queueTitle: element.matches('.queue-item') ? element.querySelector('.qi-name')?.textContent : null,
            hasInlineClick: element.hasAttribute('onclick'), draggable: element.hasAttribute('draggable'),
            presence: element.closest('[data-mobile-motion-presence]')?.getAttribute('data-mobile-motion-presence') ?? null,
            bounds: {x: rect.x, y: rect.y, width: rect.width, height: rect.height}};
    };
    const describeAnimation = animation => {
        const target = animation.effect.target, timing = animation.effect.getTiming();
        const keyframes = animation.id === 'mineradio-mobile-chrome-stage'
            || target.matches('#bottom-bar .control-cluster.modes') ? animation.effect.getKeyframes() : null;
        return {id: animation.id, state: animation.playState, pending: animation.pending,
            transitionProperty: animation.transitionProperty ?? null,
            animationName: animation.animationName ?? null,
            currentTime: animation.currentTime, duration: timing.duration, delay: timing.delay,
            properties: keyframes ? [...new Set(keyframes.flatMap(frame => Object.keys(frame)
                .filter(key => !['offset','computedOffset','easing','composite'].includes(key))))] : undefined,
            keyframes: keyframes ? keyframes.map(frame => ({opacity: frame.opacity, translate: frame.translate,
                scale: frame.scale, height: frame.height, marginTop: frame.marginTop})) : undefined,
            target: {nodeId: view.__mineradioMotionAudit?.identify?.(target) ?? null,
                tag: target.tagName, id: target.id, testid: target.getAttribute('data-testid'), classes: target.className,
                queueIndex: target.hasAttribute('data-queue-index') ? Number(target.getAttribute('data-queue-index')) : null,
                queueTitle: target.matches('.queue-item') ? target.querySelector('.qi-name')?.textContent : null},
            row: !!target.closest('[data-testid="local-track-row"]'),
            rowRoot: target.matches('[data-testid="local-track-row"]'), image: target.tagName === 'IMG'};
    };
    const describeList = element => {
        let effectiveOpacity = 1, effectiveVisible = true;
        const ancestors = [];
        for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) {
            const style = view.getComputedStyle(ancestor);
            effectiveOpacity *= Number(style.opacity);
            effectiveVisible = effectiveVisible && style.display !== 'none' && style.visibility === 'visible';
            if (ancestors.length < 10) ancestors.push({tag: ancestor.tagName,
                testid: ancestor.getAttribute('data-testid'), classes: ancestor.className,
                opacity: Number(style.opacity), visibility: style.visibility, display: style.display,
                inert: ancestor.inert, ariaHidden: ancestor.getAttribute('aria-hidden'),
                presence: ancestor.getAttribute('data-mobile-motion-presence')});
        }
        return {...describe(element), scope: element.getAttribute('data-content-scope'),
            busy: element.getAttribute('aria-busy') === 'true', effectiveOpacity, effectiveVisible, ancestors};
    };
    const read = () => {
        const api = view.MineradioMobileMotion;
        const diagnostic = typeof api?.diagnostics === 'function' ? api.diagnostics() : api?.diagnostics ?? api;
        const active = diagnostic?.activeAnimations;
        const documentAnimations = doc.getAnimations();
        const animations = uiAnimations(documentAnimations);
        const playbackAnimations = documentAnimations.filter(playbackProgressTransition);
        const activeAnimations = animations.filter(animation => animation.playState === 'running' || animation.pending);
        const rowAnimations = animations.filter(animation =>
            animation.effect.target.closest('[data-testid="local-track-row"]'));
        // Count unique animated row roots, not separate opacity/transform tracks
        // or descendant image-load/like feedback animations.
        const animatedRows = [...new Set(activeAnimations.map(animation => animation.effect.target)
            .filter(target => target.matches('[data-testid="local-track-row"]')))];
        const rows = [...doc.querySelectorAll('[data-testid="local-track-row"]')].map(element => {
            const exiting = element.getAttribute('data-mobile-motion-presence') === 'exiting';
            const ancestorExiting = !!element.parentElement?.closest('[data-mobile-motion-presence="exiting"]');
            const inert = !!element.closest('[inert]'), ariaHidden = !!element.closest('[aria-hidden="true"]');
            return {element, exiting, ancestorExiting, inert, ariaHidden,
                active: !exiting && !ancestorExiting && !inert && !ariaHidden,
                exitProtected: exiting && inert && ariaHidden};
        });
        const invalidExits = rows.filter(row => row.exiting && !row.exitProtected);
        return {at: view.performance.now(), timelineTime: doc.timeline.currentTime,
            reducedMotion: view.matchMedia('(prefers-reduced-motion: reduce)').matches,
            visibilityState: doc.visibilityState, documentHidden: doc.hidden,
            currentView: frame ? doc.querySelector('[data-testid="local-player"]')?.getAttribute('data-view')
                : doc.body.getAttribute('data-mobile-view'),
            panel: doc.querySelector('[data-testid="local-player"]')?.getAttribute('data-panel') ?? null,
            focus: doc.querySelector('[data-testid="local-player"]')?.getAttribute('data-mobile-focus') === 'true',
            viewport: {width: doc.documentElement.clientWidth, height: doc.documentElement.clientHeight},
            hostMoreExpanded: doc.body.classList.contains('mobile-controls-expanded'),
            chromeHidden: doc.body.classList.contains('mineradio-mobile-chrome-hidden'),
            diagnostics: api ? {reducedMotion: diagnostic?.reducedMotion ?? api.reducedMotion,
                activeAnimations: typeof active === 'number' ? active : Array.isArray(active) ? active.length : null} : null,
            surfaces: selectors.flatMap(selector => [...doc.querySelectorAll(selector)].slice(0, 4)
                .map(element => ({selector, ...describe(element)}))),
            animations: animations.slice(0, 32).map(describeAnimation),
            playbackProgressAnimations: playbackAnimations.slice(0, 4).map(describeAnimation),
            playbackProgressAnimationCount: playbackAnimations.length,
            documentAnimationCount: documentAnimations.length, uiAnimationCount: animations.length,
            activeUiAnimationCount: activeAnimations.length, rowDescendantAnimationCount: rowAnimations.length,
            rowImageAnimationCount: rowAnimations.filter(animation => animation.effect.target.tagName === 'IMG').length,
            rowAnimationCount: animatedRows.length,
            rowEntranceNodeCount: animatedRows.filter(element =>
                element.getAttribute('data-mobile-motion-presence') !== 'exiting').length,
            rowExitAnimationNodeCount: animatedRows.filter(element =>
                element.getAttribute('data-mobile-motion-presence') === 'exiting').length,
            rowCount: rows.length, activeRowCount: rows.filter(row => row.active).length,
            currentRowCount: rows.filter(row => !row.exiting).length,
            exitingRowCount: rows.filter(row => row.exiting).length,
            ancestorExitingRowCount: rows.filter(row => row.ancestorExiting).length,
            invalidExitRowCount: invalidExits.length,
            invalidExitRows: invalidExits.slice(0, 8).map(row => ({
                ...describe(row.element), ariaHidden: row.ariaHidden, ancestorExiting: row.ancestorExiting})),
            lists: [...doc.querySelectorAll('.local-track-list')].slice(0, 4).map(describeList),
            listRootCount: doc.querySelectorAll('.local-track-list').length};
    };
"""


class MotionAudit:
    """Keep finite traces and dispose every testing timer, RAF and listener."""

    def __init__(self, page, out, name, frame=False, report=None):
        self.page, self.out, self.name, self.frame = page, out, name, frame
        self.report = report if report is not None else {'passed': False, 'traces': [], 'checks': []}
        self.selectors = []

    def snapshot(self, selectors=None):
        return self.page.evaluate(r"""({frame, selectors}) => {
            const doc = frame ? document.getElementById('folia-frame').contentDocument : document;
            const view = doc.defaultView;
            """ + UI_ANIMATIONS + SNAPSHOT + r"""
            return read();
        }""", {'frame': self.frame, 'selectors': selectors or self.selectors})

    def wait(self, predicate, description, timeout=4):
        deadline = time.monotonic() + timeout
        state = None
        ready_since = None
        while time.monotonic() < deadline:
            state = self.snapshot()
            if predicate(state):
                ready_since = ready_since if ready_since is not None else time.monotonic()
                # A second sample catches queued layout/effect work after React commits.
                if time.monotonic() - ready_since >= .06:
                    return state
            else:
                ready_since = None
            time.sleep(min(.03, max(0, deadline - time.monotonic())))
        raise AssertionError(description + ': ' + json.dumps(state, ensure_ascii=False))

    def save(self):
        (self.out / (self.name + '.json')).write_text(
            json.dumps(self.report, ensure_ascii=False, indent=2), encoding='utf-8')

    @contextmanager
    def observe(self, label, selectors):
        self.selectors = selectors
        result = {}
        self.page.evaluate(r"""({frame, selectors, label}) => {
            const doc = frame ? document.getElementById('folia-frame').contentDocument : document;
            const view = doc.defaultView;
            view.__mineradioMotionAudit?.dispose?.();
            """ + UI_ANIMATIONS + SNAPSHOT + r"""
            const trace = {label, frame, samples: [], events: [], rafTicks: [], sampleDurationsMs: [], active: true};
            const nodeIds = new WeakMap();
            let nextNodeId = 1;
            trace.identify = element => {
                if (!nodeIds.has(element)) nodeIds.set(element, nextNodeId++);
                return nodeIds.get(element);
            };
            const sample = () => {
                if (!trace.active || trace.samples.length >= 384) return;
                const started = view.performance.now();
                trace.samples.push(read());
                trace.sampleDurationsMs.push(view.performance.now() - started);
            };
            const input = event => {
                if (!trace.active || trace.events.length >= 128) return;
                const target = event.target?.closest?.('[data-testid],button,input');
                trace.events.push({type: event.type, at: view.performance.now(), isTrusted: event.isTrusted,
                    pointerType: event.pointerType ?? null, testid: target?.getAttribute('data-testid') ?? null,
                    id: target?.id ?? null, key: event.key ?? null,
                    pointerId: event.pointerId ?? null,
                    clientPoint: {x: event.clientX ?? null, y: event.clientY ?? null},
                    nativeTarget: {tag: event.target?.tagName ?? null, id: event.target?.id ?? null,
                        testid: event.target?.getAttribute?.('data-testid') ?? null,
                        classes: event.target?.getAttribute?.('class') ?? null},
                    targetHasPointerCapture: !!(event.pointerId !== undefined && target?.hasPointerCapture?.(event.pointerId)),
                    defaultPreventedAtCapture: event.defaultPrevented,
                    resultKey: target?.getAttribute('data-result-key') ?? null,
                    chromeHidden: doc.body.classList.contains('mineradio-mobile-chrome-hidden'),
                    focus: doc.querySelector('[data-testid="local-player"]')?.getAttribute('data-mobile-focus') === 'true',
                    hostMoreExpanded: doc.body.classList.contains('mobile-controls-expanded'),
                    surfaces: event.type === 'click' || event.type === 'keydown' || event.type === 'mineradio-mobile-back'
                        ? selectors.flatMap(selector => [...doc.querySelectorAll(selector)].slice(0, 4)
                            .map(element => ({selector, ...describe(element)}))) : [],
                    animations: uiAnimations().slice(0, 24).map(describeAnimation)});
            };
            const names = ['pointerdown', 'pointerup', 'pointercancel', 'click', 'keydown', 'mineradio-mobile-back'];
            names.forEach(name => view.addEventListener(name, input, true));
            let lastSampleAt = null;
            const tick = timestamp => {
                if (!trace.active) return;
                if (trace.rafTicks.length < 512) trace.rafTicks.push(timestamp);
                trace.raf = view.requestAnimationFrame(tick);
                // Read each drawn frame at most once, with the original 16ms
                // floor on high-refresh displays. Timer polls repeated the same
                // animation frame up to fourteen times on the cloud renderer.
                if (lastSampleAt === null || timestamp - lastSampleAt >= 16) {
                    lastSampleAt = timestamp;
                    sample();
                }
            };
            trace.raf = view.requestAnimationFrame(tick);
            trace.dispose = () => {
                trace.active = false;
                view.cancelAnimationFrame(trace.raf);
                names.forEach(name => view.removeEventListener(name, input, true));
            };
            trace.read = read;
            view.__mineradioMotionAudit = trace;
            sample();
        }""", {'frame': self.frame, 'selectors': selectors, 'label': label})
        try:
            yield result
        finally:
            finished = self.page.evaluate(r"""frame => {
                const doc = frame ? document.getElementById('folia-frame').contentDocument : document;
                const trace = doc.defaultView.__mineradioMotionAudit;
                if (!trace) return null;
                const started = doc.defaultView.performance.now();
                trace.samples.push(trace.read());
                trace.sampleDurationsMs.push(doc.defaultView.performance.now() - started);
                trace.dispose();
                const gaps = trace.rafTicks.slice(1).map((tick, index) => tick - trace.rafTicks[index]);
                const result = {label: trace.label, frame: trace.frame, samples: trace.samples, events: trace.events,
                    rafTicks: trace.rafTicks, rafMaxGapMs: gaps.length ? Math.max(...gaps) : null,
                    sampleMethod: 'raf-with-sync-boundaries', sampleIntervalFloorMs: 16,
                    sampleDurationsMs: trace.sampleDurationsMs,
                    observerDisposed: !trace.active};
                delete doc.defaultView.__mineradioMotionAudit;
                return result;
            }""", self.frame)
            result.update(finished or {'label': label, 'observationFailed': True})
            self.report['traces'].append(result)
            self.save()

    def inputs(self):
        return self.page.evaluate(r"""frame => {
            const doc = frame ? document.getElementById('folia-frame').contentDocument : document;
            return doc.defaultView.__mineradioMotionAudit?.events ?? [];
        }""", self.frame)


class TouchDriver:
    """Probe real hit targets before trusted CDP touch events, without force clicks."""

    def __init__(self, page, report=None):
        self.page = page
        self.session = page.context.new_cdp_session(page)
        self.wake_checks = []
        self.touch_checks = []
        self.input_serial = 0
        if report is not None:
            report['wakeChecks'] = self.wake_checks
            report['touchChecks'] = self.touch_checks

    def close(self):
        try:
            if not self.page.is_closed():
                self.page.evaluate("""() => {
                    const frame = document.getElementById('folia-frame');
                    for (const view of [window, frame?.contentDocument?.defaultView]) {
                        view?.__mineradioTouchProbe?.dispose();
                        if (view) delete view.__mineradioTouchProbe;
                    }
                }""")
        finally:
            self.session.detach()

    def point(self, selector, frame=False, input_token=None, wake_token=None):
        return self.page.evaluate(r"""({selector, frame, inputToken, wakeToken}) => {
            const iframe = frame ? document.getElementById('folia-frame') : null;
            const doc = iframe ? iframe.contentDocument : document, view = doc.defaultView;
            const findTarget = (query, token) => {
            const candidates = [...doc.querySelectorAll(query)];
            for (const element of candidates) {
                const rect = element.getBoundingClientRect(), style = view.getComputedStyle(element);
                if (element.matches(':disabled') || element.closest('[inert],[aria-disabled="true"]')
                    || !rect.width || !rect.height || style.pointerEvents === 'none') continue;
                let visible = true;
                for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) {
                    const state = view.getComputedStyle(ancestor);
                    if (state.display === 'none' || state.visibility !== 'visible' || Number(state.opacity) < .9) {
                        visible = false; break;
                    }
                }
                if (!visible) continue;
                const point = {x: rect.left + rect.width / 2, y: rect.top + rect.height / 2};
                const hit = doc.elementFromPoint(point.x, point.y);
                if (!hit || !(element === hit || element.contains(hit))) continue;
                if (iframe) {
                    const box = iframe.getBoundingClientRect();
                    point.x += box.left; point.y += box.top;
                    if (document.elementFromPoint(point.x, point.y) !== iframe) continue;
                }
                if (token !== null) {
                    view.__mineradioTouchProbe?.dispose();
                    const probe = {token, events: []};
                    const input = event => {
                        if (probe.events.length >= 8) return;
                        probe.events.push({event, state: {
                            type: event.type, at: view.performance.now(), hostAt: performance.now(),
                            isTrusted: event.isTrusted, pointerType: event.pointerType ?? null,
                            pointerId: event.pointerId ?? null,
                            point: {x: event.clientX ?? null, y: event.clientY ?? null},
                            expectedTarget: event.target === element || element.contains(event.target),
                            nativeTarget: {tag: event.target?.tagName ?? null, id: event.target?.id ?? null,
                                testid: event.target?.getAttribute?.('data-testid') ?? null,
                                classes: event.target?.getAttribute?.('class') ?? null},
                            hidden: doc.body.classList.contains('mineradio-mobile-chrome-hidden'),
                            mobileFoliaEnabled: !!(iframe && window.MineradioMobile?.active
                                && document.body.classList.contains('mobile-layout')
                                && document.body.classList.contains('folia-interface-active'))
                        }});
                    };
                    const names = ['pointerdown', 'pointerup', 'pointercancel', 'click'];
                    probe.dispose = () => {
                        try {
                            names.forEach(name => view.removeEventListener(name, input, true));
                        } finally {
                            probe.events.length = 0;
                        }
                    };
                    try {
                        names.forEach(name => view.addEventListener(name, input, true));
                        view.__mineradioTouchProbe = probe;
                    } catch (error) {
                        probe.dispose();
                        throw error;
                    }
                }
                return {point, bounds: {x: rect.x, y: rect.y, width: rect.width, height: rect.height},
                    tag: element.tagName, testid: element.getAttribute('data-testid'), id: element.id,
                    at: view.performance.now(), hostAt: performance.now(), inputToken: token};
            }
            return null;
            };
            const target = findTarget(selector, inputToken);
            if (target) return target;
            if (wakeToken !== null && iframe && selector !== '[data-testid="local-player"]'
                && doc.body.classList.contains('mineradio-mobile-chrome-hidden')) {
                const frame = iframe;
                """ + FOLIA_CHROME_READINESS + r"""
                const state = chromeReadiness();
                if (state.hidden) {
                    const stage = findTarget('[data-testid="local-player"]', wakeToken);
                    return {preparedWake: {token: wakeToken, target: stage, state}};
                }
            }
            return null;
        }""", {'selector': selector, 'frame': frame,
            'inputToken': input_token, 'wakeToken': wake_token})

    def collect_input(self, token, frame, read_readiness=False):
        return self.page.evaluate("""({token, frame: inFrame, readReadiness}) => {
            const frame = inFrame ? document.getElementById('folia-frame') : null;
            const doc = inFrame ? frame?.contentDocument : document;
            const view = doc?.defaultView, probe = view?.__mineradioTouchProbe;
            try {
                // Event references remain until dispatch finishes, including
                // the final defaultPrevented value from the wake handler.
                const result = !probe || probe.token !== token
                    ? {token, probeMissing: true, events: []}
                    : {token, events: probe.events.map(({event, state}) =>
                        ({...state, defaultPrevented: event.defaultPrevented}))};
                if (readReadiness) {
                    """ + FOLIA_CHROME_READINESS + """
                    result.chromeReadiness = chromeReadiness();
                }
                return result;
            } finally {
                if (probe?.token === token) {
                    try {
                        probe.dispose();
                    } finally {
                        if (view.__mineradioTouchProbe === probe) delete view.__mineradioTouchProbe;
                    }
                }
            }
        }""", {'token': token, 'frame': frame, 'readReadiness': read_readiness})

    def touch(self, selector, frame=False, hold=0, cancel=False, prepared_stage=None):
        deadline = prepared_stage['outerDeadline'] if prepared_stage is not None else time.monotonic() + 4
        check = {'selector': selector, 'frame': frame,
            'windowStartedAtDriverMs': (deadline - 4) * 1000,
            'deadlineAtDriverMs': deadline * 1000,
            'pointProbes': [], 'chromeProbes': [], 'dispatches': [], 'wakeAttempted': False}
        self.touch_checks.append(check)
        if self.wake_checks:
            self.wake_checks[-1].setdefault('touchPreparations', []).append(check)
        if prepared_stage is not None:
            prepared_stage['touchCheck'] = check
            check['preparedStagePointReused'] = True
        while True:
            if prepared_stage is not None:
                token = prepared_stage['token']
                target = prepared_stage['target']
                check['pointProbes'].append(prepared_stage['pointProbe'])
            else:
                self.input_serial += 1
                token = self.input_serial
                target = None
                while time.monotonic() < deadline:
                    wake_token = None
                    if (frame and selector != '[data-testid="local-player"]'
                            and not check['wakeAttempted']):
                        self.input_serial += 1
                        wake_token = self.input_serial
                    point_started = time.monotonic()
                    result = self.point(selector, frame, input_token=token, wake_token=wake_token)
                    point_returned = time.monotonic()
                    prepared_wake = result.get('preparedWake') if result else None
                    target = None if prepared_wake is not None else result
                    point_probe = {'startedAtDriverMs': point_started * 1000,
                        'returnedAtDriverMs': point_returned * 1000,
                        'durationMs': (point_returned - point_started) * 1000, 'target': target}
                    check['pointProbes'].append(point_probe)
                    if target:
                        break
                    if prepared_wake is not None:
                        chrome_state = prepared_wake['state']
                        chrome_probe = {'startedAtDriverMs': point_started * 1000,
                            'returnedAtDriverMs': point_returned * 1000,
                            'durationMs': (point_returned - point_started) * 1000,
                            'hidden': chrome_state['hidden'], 'state': chrome_state,
                            'returnedWithinDeadline': point_returned < deadline,
                            'coalescedWithPoint': True}
                        check['chromeProbes'].append(chrome_probe)
                        prepared_wake['pointProbe'] = {**point_probe, 'target': prepared_wake['target'],
                            'coalescedWithRequestedPoint': True}
                        prepared_wake['outerDeadline'] = deadline
                        wake_started = time.monotonic()
                        preparation = {'startedAtDriverMs': wake_started * 1000,
                            'startedWithinDeadline': wake_started < deadline,
                            'stageTarget': prepared_wake['target'], 'stageToken': prepared_wake['token']}
                        check['wakePreparation'] = preparation
                        try:
                            if prepared_wake['target'] and point_returned < deadline and wake_started < deadline:
                                check['wakeAttempted'] = True
                                self.wake(initial_probe=chrome_probe,
                                    prepared_wake=prepared_wake, outer_deadline=deadline)
                        finally:
                            try:
                                if prepared_wake['target'] and not prepared_wake.get('inputCollected'):
                                    self.collect_input(prepared_wake['token'], frame)
                            finally:
                                wake_returned = time.monotonic()
                                preparation['returnedAtDriverMs'] = wake_returned * 1000
                                preparation['durationMs'] = (wake_returned - wake_started) * 1000
                                preparation['returnedWithinDeadline'] = wake_returned < deadline
                        # The button must be located and captured again after the
                        # stage gesture, within the original caller's deadline.
                        self.input_serial += 1
                        token = self.input_serial
                    time.sleep(min(.03, max(0, deadline - time.monotonic())))
            lookup_returned = time.monotonic()
            check['targetLookupCompletedAtDriverMs'] = lookup_returned * 1000
            check['targetLookupDurationMs'] = (lookup_returned - (deadline - 4)) * 1000
            input_checked = time.monotonic()
            check['inputDeadlineCheckedAtDriverMs'] = input_checked * 1000
            check['inputWithinDeadline'] = input_checked < deadline
            if input_checked >= deadline:
                check['lateTargetRejected'] = bool(target)
                if target:
                    self.collect_input(token, frame)
                target = None
            check['targetFound'] = bool(target)
            assert target, f'No visible, enabled, real touch target for {selector}'
            dispatch = {'token': token, 'target': target,
                'startedAtDriverMs': time.monotonic() * 1000}
            check['dispatches'].append(dispatch)
            try:
                try:
                    start = time.monotonic()
                    dispatch['dispatchWithinDeadline'] = start < deadline
                    assert start < deadline, f'The touch dispatch for {selector} missed its original target deadline'
                    self.session.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [target['point']]})
                    dispatch['touchStartDurationMs'] = (time.monotonic() - start) * 1000
                    if hold:
                        self.page.wait_for_timeout(hold)
                finally:
                    end = time.monotonic()
                    self.session.send('Input.dispatchTouchEvent', {
                        'type': 'touchCancel' if cancel else 'touchEnd', 'touchPoints': []})
                    completed = time.monotonic()
                    dispatch['touchEndDurationMs'] = (completed - end) * 1000
                    dispatch['completedAtDriverMs'] = completed * 1000
            finally:
                collect_started = time.monotonic()
                gesture = self.collect_input(token, frame, read_readiness=prepared_stage is not None)
                collect_returned = time.monotonic()
                dispatch['actualInput'] = gesture
                dispatch['collectDurationMs'] = (collect_returned - collect_started) * 1000
                dispatch['collectReturnedAtDriverMs'] = collect_returned * 1000
                if prepared_stage is not None:
                    prepared_stage['inputCollected'] = True
                    prepared_stage['dispatch'] = dispatch
            downs = [event for event in gesture['events'] if event['type'] == 'pointerdown']
            assert len(downs) == 1 and downs[0]['isTrusted'] and downs[0]['pointerType'] == 'touch', \
                f'The touch for {selector} did not produce one trusted physical pointerdown'
            down = downs[0]
            consumed_wake = (frame and selector != '[data-testid="local-player"]'
                and target['tag'] == 'BUTTON' and not hold and not cancel
                and down['mobileFoliaEnabled'] and down['hidden'] and down['defaultPrevented'])
            dispatch['consumedWake'] = consumed_wake
            if check['wakeAttempted']:
                assert not down['hidden'], f'The prepared touch for {selector} reached hidden chrome again'
            if consumed_wake:
                assert not check['wakeAttempted'], f'The touch for {selector} was consumed by idle wake twice'
                check['wakeAttempted'] = True
                # The actual first tap has already woken chrome. Only poll; a
                # further stage tap would consume another gesture and hide a race.
                recovery_deadline = min(deadline, completed + 2)
                recovery = {'windowStartedAtDriverMs': completed * 1000,
                    'deadlineAtDriverMs': recovery_deadline * 1000,
                    'originalReadinessLimitMs': 2000, 'polls': [], 'ready': False}
                check['consumedWakeRecovery'] = recovery
                while time.monotonic() < recovery_deadline:
                    state = self.page.evaluate("""() => {
                        const frame = document.getElementById('folia-frame'), doc = frame.contentDocument, view = doc.defaultView;
                        """ + FOLIA_CHROME_READINESS + """
                        return chromeReadiness();
                    }""")
                    returned = time.monotonic()
                    recovery['polls'].append({'elapsedMs': (returned - completed) * 1000, 'state': state,
                        'returnedWithinDeadline': returned <= recovery_deadline})
                    if state['ready'] and returned <= recovery_deadline:
                        recovery['ready'] = True
                        break
                    time.sleep(min(.03, max(0, recovery_deadline - time.monotonic())))
                assert recovery['ready'], f'The consumed wake for {selector} did not restore chrome within its original deadlines'
                continue
            assert down['expectedTarget'], f'The physical pointerdown for {selector} missed the probed target'
            if target['tag'] == 'BUTTON' and not hold and not cancel:
                clicks = [event for event in gesture['events'] if event['type'] == 'click']
                assert len(clicks) == 1 and clicks[0]['isTrusted'] and clicks[0]['expectedTarget'], \
                    f'The touch for {selector} did not produce a trusted click on the real button'
            return target

    def _wake_prepared(self, initial_probe, prepared_wake, outer_deadline):
        initial = initial_probe['state']
        evidence = {'hiddenBefore': initial['hidden'], 'initialState': initial,
            'initialProbeDurationMs': initial_probe['durationMs'], 'initialProbeReused': True,
            'preparedStagePointReused': True, 'touchSent': False, 'polls': [], 'ready': False}
        self.wake_checks.append(evidence)
        assert initial['hidden'] and prepared_wake['target'], \
            'The coalesced wake requires hidden chrome and a real prepared stage target'
        prepared_wake['outerDeadline'] = outer_deadline
        evidence['touchSent'] = True
        evidence['touchMethodStartedAtDriverMs'] = time.monotonic() * 1000
        evidence['touchTarget'] = self.touch('[data-testid="local-player"]',
            frame=True, prepared_stage=prepared_wake)
        evidence['touchMethodCompletedAtDriverMs'] = time.monotonic() * 1000
        dispatch = prepared_wake['dispatch']
        completed = dispatch['completedAtDriverMs'] / 1000
        returned = dispatch['collectReturnedAtDriverMs'] / 1000
        deadline = min(outer_deadline, completed + 2)
        evidence['windowStartedAtDriverMs'] = completed * 1000
        evidence['deadlineAtDriverMs'] = deadline * 1000
        evidence['outerDeadlineAtDriverMs'] = outer_deadline * 1000
        evidence['originalReadinessLimitMs'] = 2000
        evidence['touchEndCompletedAtDriverMs'] = completed * 1000
        evidence['collectReturnedAtDriverMs'] = returned * 1000
        state = dispatch['actualInput']['chromeReadiness']
        evidence['polls'].append({'elapsedMs': (returned - completed) * 1000, 'state': state,
            'returnedWithinDeadline': returned <= deadline, 'coalescedWithInputCollection': True})
        if state['ready'] and returned <= deadline:
            evidence['ready'] = True
            return
        readiness = """() => {
            const frame = document.getElementById('folia-frame'), doc = frame.contentDocument, view = doc.defaultView;
            """ + FOLIA_CHROME_READINESS + """
            return chromeReadiness();
        }"""
        # Collection time belongs to the touchEnd readiness window. If this
        # fresh sample is not ready, only poll within that same bounded window.
        while time.monotonic() < deadline:
            state = self.page.evaluate(readiness)
            returned = time.monotonic()
            evidence['polls'].append({'elapsedMs': (returned - completed) * 1000, 'state': state,
                'returnedWithinDeadline': returned <= deadline})
            if state['ready'] and returned <= deadline:
                evidence['ready'] = True
                return
            time.sleep(min(.03, max(0, deadline - time.monotonic())))
        evidence['failedWindowDurationMs'] = (time.monotonic() - completed) * 1000
        raise AssertionError('The additional motion audit did not observe ready Folia chrome within 2000ms')

    def wake(self, initial_probe=None, prepared_wake=None, outer_deadline=None):
        if prepared_wake is not None:
            return self._wake_prepared(initial_probe, prepared_wake, outer_deadline)
        readiness = """() => {
            const frame = document.getElementById('folia-frame'), doc = frame.contentDocument, view = doc.defaultView;
            """ + FOLIA_CHROME_READINESS + """
            return chromeReadiness();
        }"""
        # Reuse the caller's real initial sample instead of issuing a duplicate RPC.
        if initial_probe is None:
            probe_started = time.monotonic()
            initial = self.page.evaluate(readiness)
            initial_probe_duration_ms = (time.monotonic() - probe_started) * 1000
        else:
            initial = initial_probe['state']
            initial_probe_duration_ms = initial_probe['durationMs']
        evidence = {'hiddenBefore': initial['hidden'], 'initialState': initial,
            'initialProbeDurationMs': initial_probe_duration_ms,
            'initialProbeReused': initial_probe is not None,
            'touchSent': False, 'polls': [], 'ready': False}
        self.wake_checks.append(evidence)
        if initial['ready']:
            if evidence['initialProbeDurationMs'] > 2000:
                evidence['failedWindowDurationMs'] = evidence['initialProbeDurationMs']
                raise AssertionError('The additional motion audit did not observe ready Folia chrome within 2000ms')
            evidence['ready'] = True
            return

        def send_wake():
            evidence['touchSent'] = True
            evidence['touchMethodStartedAtDriverMs'] = time.monotonic() * 1000
            evidence['touchTarget'] = self.touch('[data-testid="local-player"]', frame=True)
            evidence['touchMethodCompletedAtDriverMs'] = time.monotonic() * 1000

        if initial['hidden']:
            send_wake()
        started = time.monotonic()
        deadline = started + 2
        evidence['windowStartedAtDriverMs'] = started * 1000
        evidence['deadlineAtDriverMs'] = deadline * 1000
        while time.monotonic() < deadline:
            state = self.page.evaluate(readiness)
            evidence['polls'].append({'elapsedMs': (time.monotonic() - started) * 1000, 'state': state})
            if state['ready'] and time.monotonic() <= deadline:
                evidence['ready'] = True
                return
            # Idle may expire after a visible initial probe. Wake once within
            # the existing window; delayed input never starts a new deadline.
            if state['hidden'] and not evidence['touchSent'] and time.monotonic() < deadline:
                point_started = time.monotonic()
                target = self.point('[data-testid="local-player"]', frame=True)
                point_returned = time.monotonic()
                point_check = {'startedAtDriverMs': point_started * 1000,
                    'returnedAtDriverMs': point_returned * 1000,
                    'durationMs': (point_returned - point_started) * 1000,
                    'target': target, 'returnedWithinDeadline': point_returned < deadline}
                evidence.setdefault('fallbackPointChecks', []).append(point_check)
                if target and point_returned < deadline:
                    dispatch_started = time.monotonic()
                    point_check['dispatchCheckedAtDriverMs'] = dispatch_started * 1000
                    point_check['dispatchWithinDeadline'] = dispatch_started < deadline
                    if dispatch_started < deadline:
                        evidence['touchSent'] = True
                        evidence['touchTarget'] = target
                        evidence['touchMethodStartedAtDriverMs'] = dispatch_started * 1000
                        try:
                            self.session.send('Input.dispatchTouchEvent', {
                                'type': 'touchStart', 'touchPoints': [target['point']]})
                        finally:
                            self.session.send('Input.dispatchTouchEvent', {
                                'type': 'touchEnd', 'touchPoints': []})
                            evidence['touchMethodCompletedAtDriverMs'] = time.monotonic() * 1000
            time.sleep(min(.03, max(0, deadline - time.monotonic())))
        evidence['failedWindowDurationMs'] = (time.monotonic() - started) * 1000
        raise AssertionError('The additional motion audit did not observe ready Folia chrome within 2000ms')

    def swipe(self, selector, frame=False):
        target = self.point(selector, frame)
        assert target, f'No real swipe target for {selector}'
        point = target['point']
        self.session.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [point]})
        try:
            for index in range(1, 9):
                self.session.send('Input.dispatchTouchEvent', {'type': 'touchMove',
                    'touchPoints': [{'x': point['x'], 'y': point['y'] - index * 22}]})
                self.page.wait_for_timeout(16)
        finally:
            self.session.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})


def surface(state, selector):
    return [node for node in state['surfaces'] if node['selector'] == selector]


def visible(state, selector):
    return any(node['display'] != 'none' and node['visibility'] == 'visible'
        and node['opacity'] > .9 and not node['inert'] for node in surface(state, selector))


def hidden(state, selector):
    return all(node['display'] == 'none' or node['visibility'] == 'hidden' or node['opacity'] <= .01
        for node in surface(state, selector))


def settled(state):
    return state['activeUiAnimationCount'] == 0


def assert_touch(trace):
    downs = [event for event in trace['events'] if event['type'] == 'pointerdown']
    assert downs and all(event['isTrusted'] and event['pointerType'] == 'touch' for event in downs), \
        trace['label'] + ': motion must be triggered by trusted touch input'
    assert trace.get('observerDisposed'), trace['label'] + ': testing observers were not disposed'


def assert_fade(trace, selectors):
    assert any(0 < node['opacity'] < 1 and node['visibility'] == 'visible'
        for state in trace['samples'] for node in state['surfaces'] if node['selector'] in selectors), \
        trace['label'] + ': no visible intermediate opacity was observed'


def assert_stable_size(trace, selector):
    boxes = [node['bounds'] for state in trace['samples'] for node in surface(state, selector)
        if node['display'] != 'none' and node['bounds']['width'] and node['bounds']['height']]
    assert boxes, trace['label'] + ': missing geometry for ' + selector
    assert max(box['width'] for box in boxes) - min(box['width'] for box in boxes) < 2, \
        trace['label'] + ': animated width changed for ' + selector
    assert max(box['height'] for box in boxes) - min(box['height'] for box in boxes) < 2, \
        trace['label'] + ': animated height changed for ' + selector


def assert_list_bounds(trace, stable_root=False):
    """The persistent Folia list has no exit leases and never mounts over 60 rows."""
    for index, state in enumerate(trace['samples']):
        where = f"{trace['label']}, sample {index}"
        assert state['listRootCount'] <= 1, where + ': more than one list page was mounted'
        assert state['activeRowCount'] <= 60 and state['currentRowCount'] <= 60 and state['rowCount'] <= 60, \
            where + ': the current interactive page exceeded 60 tracks'
        assert state['exitingRowCount'] == 0, where + ': the persistent list retained an outgoing row lease'
        assert state['invalidExitRowCount'] == 0, \
            where + ': an exiting row lacked explicit presence, inert or aria-hidden protection'
        assert state['rowAnimationCount'] <= 8, \
            where + ': more than eight unique row roots animated concurrently'
        if stable_root:
            assert state['listRootCount'] == 1, where + ': the list container disappeared during refresh'
            assert state['lists'][0]['effectiveVisible'] and state['lists'][0]['effectiveOpacity'] > .9, \
                where + ': the list or an ancestor was hidden or faded during refresh'
    final = trace['samples'][-1]
    assert final['rowCount'] <= 60 and final['exitingRowCount'] == 0, \
        trace['label'] + ': row exits did not release after the transition settled'
    if stable_root:
        assert len({state['lists'][0]['nodeId'] for state in trace['samples']}) == 1, \
            trace['label'] + ': refresh replaced the persistent list DOM node'


def assert_same_nodes(trace, selectors):
    for selector in selectors:
        nodes = [surface(state, selector) for state in trace['samples']]
        assert all(len(group) == 1 for group in nodes), \
            trace['label'] + ': a live surface was removed or duplicated: ' + selector
        assert len({group[0]['nodeId'] for group in nodes}) == 1, \
            trace['label'] + ': a live surface was replaced: ' + selector


def assert_protected_exits(trace, selectors, host_more=False):
    for state in trace['samples']:
        for selector in selectors:
            for node in surface(state, selector):
                exiting = node['morePhase'] == 'leaving' if host_more else node['presence'] == 'exiting'
                if exiting:
                    assert node['inert'] and node['ariaHidden'], \
                        trace['label'] + ': outgoing content remained interactive or accessible: ' + selector


def interrupted_more_click(event, selector):
    if event['type'] != 'click' or not event['isTrusted'] or event['id'] != 'mobile-player-more':
        return False
    return any(node['selector'] == selector and node['morePhase'] == 'leaving'
        and any(animation['target']['nodeId'] == node['nodeId'] and animation['state'] == 'running'
            and isinstance(animation['currentTime'], (int, float)) and isinstance(animation['duration'], (int, float))
            and 0 < animation['currentTime'] < animation['duration'] for animation in event['animations'])
        for node in event['surfaces'])


def verify_host_more(audit, driver):
    """Reverse the live measured row with real clicks and prove the interruption."""
    selector = '#bottom-bar .control-cluster.modes'
    watched = [selector, '#mobile-player-more', '#controls .control-cluster.actions', '#controls .control-cluster.transport']
    audit.selectors = watched

    def opened(state):
        nodes = surface(state, selector)
        return state['hostMoreExpanded'] and len(nodes) == 1 and visible(state, selector) \
            and not nodes[0]['ariaHidden'] and nodes[0]['morePhase'] is None and settled(state) \
            and surface(state, '#mobile-player-more')[0]['expanded'] == 'true'

    def closed(state):
        nodes = surface(state, selector)
        return not state['hostMoreExpanded'] and len(nodes) == 1 and hidden(state, selector) \
            and nodes[0]['inert'] and nodes[0]['ariaHidden'] and nodes[0]['morePhase'] is None and settled(state) \
            and surface(state, '#mobile-player-more')[0]['expanded'] == 'false'

    if audit.page.locator('#mobile-player-more').get_attribute('aria-expanded') == 'true':
        driver.touch('#mobile-player-more')
        audit.wait(closed, 'The existing More row did not close before the audit')
    with audit.observe('host-more-enter', watched) as trace:
        driver.touch('#mobile-player-more')
        audit.wait(opened, 'The player More row did not finish entering')
    assert_touch(trace)
    assert_fade(trace, [selector])
    assert_same_nodes(trace, watched)
    for fixed in watched[2:]:
        assert_stable_size(trace, fixed)

    with audit.observe('host-more-exit', watched) as trace:
        driver.touch('#mobile-player-more')
        audit.wait(closed, 'The player More row did not finish closing and clear its transient state')
    assert_touch(trace)
    assert_fade(trace, [selector])
    assert_protected_exits(trace, [selector], host_more=True)
    assert_same_nodes(trace, watched)

    with audit.observe('host-more-real-close-reopen', watched) as trace:
        driver.touch('#mobile-player-more')
        audit.wait(opened, 'The player More row did not reopen')
        observed = False
        for attempt in range(3):
            driver.touch('#mobile-player-more')
            # Back-to-back input can arrive before WAAPI has drawn its first
            # frame. Wait for real progress before testing a mid-flight reversal;
            # a naturally completed close still reopens and uses the next attempt.
            audit.page.wait_for_function(r"""selector => {
                const row = document.querySelector(selector);
                if (row?.getAttribute('data-mobile-motion-more') !== 'leaving') return true;
                return row.getAnimations().some(animation =>
                    animation.id === 'mineradio-mobile-component'
                    && animation.playState === 'running'
                    && typeof animation.currentTime === 'number' && animation.currentTime > 0);
            }""", arg=selector, polling='raf', timeout=2000)
            driver.touch('#mobile-player-more')
            # Inspect the captured click before its handler changed state.
            # A completed close is never reported as an interrupted animation.
            observed = any(interrupted_more_click(event, selector) for event in audit.inputs())
            audit.wait(opened, 'Closing then reopening More left stale height, opacity or inert state')
            if observed:
                break
    trace['interruptionObserved'] = observed
    trace['attempts'] = attempt + 1
    assert observed, 'No trusted More click actually interrupted the closing animation after three natural attempts'
    assert_touch(trace)
    assert_fade(trace, [selector])
    assert_same_nodes(trace, watched)
    assert_protected_exits(trace, [selector], host_more=True)
    row_animations = [animation for state in trace['samples'] for animation in state['animations']
        if animation['target']['nodeId'] == surface(state, selector)[0]['nodeId']]
    assert row_animations and all(animation['duration'] == 200 for animation in row_animations), \
        'The player More row did not use the shared 200ms component transition'
    assert any(animation.get('keyframes') and .01 < float(animation['keyframes'][0].get('opacity', 0)) < .99
        for animation in row_animations), 'The reversed More row restarted from an endpoint instead of its drawn opacity'
    driver.touch('#mobile-player-more')
    audit.wait(closed, 'More cleanup did not leave a fully collapsed player row')
    audit.report['checks'].append('Player More enters, reverses a witnessed live close and clears height/presence state with fixed control sizes')


def verify_host_queue_removal(audit, driver):
    """Delete one visible fixture row and inspect the ghost and actual following target."""
    rows, ghost = '#queue-list > .queue-item', 'body > .mobile-row-leaving'
    watched = [rows, ghost, '#playlist-panel']
    audit.selectors = watched
    driver.touch('#mobile-nav [data-mobile-view="library"]')
    audit.wait(lambda state: visible(state, '#playlist-panel') and settled(state), 'The queue page did not enter')
    driver.touch('#tab-queue')
    audit.wait(lambda state: len(surface(state, rows)) == 2 and visible(state, rows) and settled(state),
        'The existing two-track fixture did not expose both queue rows')
    # Keep the removed row away from the playing fixture, using the ordinary row UI.
    if audit.page.evaluate('currentIdx') != 1:
        driver.touch('#queue-list [data-queue-index="1"] .qi-name')
        audit.page.wait_for_function('currentIdx === 1 && audio && !audio.paused', timeout=10000)
        audit.wait(lambda state: len(surface(state, rows)) == 2 and settled(state), 'The queue did not settle after selecting its second fixture')
    source = audit.page.evaluate('audio.src')
    with audit.observe('host-visible-queue-removal', watched) as trace:
        before = audit.snapshot()
        titles = [node['queueTitle'] for node in surface(before, rows)]
        driver.touch('#queue-list [data-queue-index="0"] .qi-act button[title="移除"]')
        after = audit.wait(lambda state: len(surface(state, rows)) == 1
            and surface(state, rows)[0]['queueTitle'] == titles[1] and surface(state, rows)[0]['queueIndex'] == 0
            and not surface(state, ghost) and settled(state), 'Queue deletion did not finish with the remaining fixture at index zero')
    trace['beforeRemoval'] = before
    trace['afterRemoval'] = after
    assert_touch(trace)
    ghosts = [node for state in trace['samples'] for node in surface(state, ghost)]
    assert ghosts and all(node['inert'] and node['ariaHidden'] and node['pointerEvents'] == 'none'
        and not node['hasInlineClick'] and not node['draggable'] and node['queueTitle'] == titles[0] for node in ghosts), \
        'The removed queue fixture did not produce a protected, inert ghost'
    assert_fade(trace, [ghost])
    following = [animation for state in trace['samples'] for animation in state['animations']
        if animation['id'] == 'mineradio-mobile-component'
        and 'queue-item' in str(animation['target']['classes']) and 'mobile-row-leaving' not in str(animation['target']['classes'])]
    assert following and all(animation['target']['queueIndex'] == 0 and animation['target']['queueTitle'] == titles[1]
        for animation in following), 'The delete animation measured or animated the old queue DOM instead of the remaining fixture'
    for state in trace['samples']:
        animated = {animation['target']['nodeId'] for animation in state['animations']
            if animation['id'] == 'mineradio-mobile-component' and animation['state'] == 'running'
            and 'queue-item' in str(animation['target']['classes'])
            and 'mobile-row-leaving' not in str(animation['target']['classes'])}
        assert len(animated) <= 8, 'Queue removal animated more than eight following rows'
    assert audit.page.evaluate('audio.src') == source and audit.page.evaluate('!audio.paused'), \
        'Removing the other queue fixture interrupted the playing source'
    driver.touch('#mobile-nav [data-mobile-view="player"]')
    audit.wait(lambda state: state['currentView'] == 'player' and settled(state), 'Queue removal did not return to the player')
    audit.report['checks'].append('Visible queue deletion updates the DOM before animating the correct following row, then releases its protected ghost')


def verify_folia_focus(audit, driver):
    """Use the existing command UI and retain all three live chrome instances."""
    roots = ['[data-testid="local-navigation"]', '[data-testid="local-controls"]', '[data-testid="local-current-track"]']
    chrome = ['.local-mobile-header', '.local-mobile-nav', '[data-testid="local-controls"]', '[data-testid="local-current-track"]']
    command = '[data-testid="local-command-palette"]'
    exit_button = '[data-testid="local-exit-focus"]'
    more = '[data-testid="local-mobile-more"]'
    watched = list(dict.fromkeys(roots + chrome + [command, exit_button, more,
        '[data-testid="local-visualizer"]', '[data-testid="local-record-wall"]', '[data-testid="local-poster-wall"]']))
    audit.selectors = watched
    with audit.observe('folia-focus-ui-enter-exit', watched) as trace:
        before = audit.snapshot()
        stage = {'lyrics': '[data-testid="local-visualizer"]', 'records': '[data-testid="local-record-wall"]',
            'posters': '[data-testid="local-poster-wall"]'}[before['currentView']]
        assert len(surface(before, stage)) == 1, 'The focus audit is missing its live visual stage'
        driver.touch('[data-testid="local-mobile-more-toggle"]', frame=True)
        audit.wait(lambda state: visible(state, more) and settled(state), 'The focus command menu did not enter')
        # The real open menu protects the normal chrome from idle expiry while
        # these read-only checks run on a slow cloud renderer.
        audit.wait(lambda state: not state['focus'] and state['panel'] == 'closed' and settled(state)
            and all(visible(state, selector) for selector in chrome), 'Focus audit did not begin with visible normal chrome')
        driver.touch('[data-testid="local-open-commands"]', frame=True)
        audit.wait(lambda state: visible(state, command) and not surface(state, more) and settled(state),
            'The command UI did not become ready for the focus action')
        title = audit.page.frame_locator('#folia-frame').get_by_test_id('local-command-palette') \
            .locator('.local-panel-title > strong').inner_text()
        query = '沉浸播放' if any('\u4e00' <= character <= '\u9fff' for character in title) else 'Immersive player'
        audit.page.frame_locator('#folia-frame').get_by_test_id('local-command-search').fill(query)
        driver.touch(command + ' [data-result-kind="action"][data-result-key="focus"]', frame=True)
        focused = audit.wait(lambda state: state['focus'] and state['panel'] == 'closed'
            and not surface(state, command) and visible(state, exit_button) and settled(state)
            and all(len(surface(state, selector)) == 1 and surface(state, selector)[0]['opacity'] <= .01
                and surface(state, selector)[0]['visibility'] == 'hidden'
                and surface(state, selector)[0]['pointerEvents'] == 'none' for selector in chrome),
            'Manual focus did not finish hiding retained mobile chrome', timeout=8)
        for selector in roots:
            node = surface(focused, selector)[0]
            assert node['inert'] and node['ariaHidden'] and node['mobileFocus'] == 'true', \
                'Manual focus left its retained chrome root interactive: ' + selector
        stage_bounds = surface(focused, stage)[0]['bounds']
        assert abs(stage_bounds['x']) <= 1 and abs(stage_bounds['y']) <= 1 \
            and abs(stage_bounds['width'] - focused['viewport']['width']) <= 1 \
            and abs(stage_bounds['height'] - focused['viewport']['height']) <= 1, \
            'Manual focus did not fill the current visual viewport'
        driver.touch(exit_button, frame=True)
        restored = audit.wait(lambda state: not state['focus'] and state['panel'] == 'closed'
            and not surface(state, exit_button) and not surface(state, command) and settled(state)
            and all(visible(state, selector) for selector in chrome),
            'Exiting manual focus did not release the button and restore usable chrome', timeout=8)
    trace['commandTitle'] = title
    trace['focusQuery'] = query
    trace['beforeFocus'] = before
    trace['focused'] = focused
    trace['restored'] = restored
    assert_touch(trace)
    assert any(event['type'] == 'click' and event['isTrusted'] and event['resultKey'] == 'focus' for event in trace['events']), \
        'Manual focus was not entered through a trusted click on the real command result'
    assert_same_nodes(trace, roots + [stage])
    entered = [state for state in trace['samples'] if state['focus']]
    assert entered, 'No committed manual focus state was observed'
    assert_fade({'label': trace['label'] + '-entry', 'samples': entered}, chrome[:2])
    last_focus = max(index for index, state in enumerate(trace['samples']) if state['focus'])
    assert_fade({'label': trace['label'] + '-exit', 'samples': trace['samples'][last_focus + 1:]}, chrome)
    for selector in roots:
        node = surface(restored, selector)[0]
        assert not node['inert'] and not node['ariaHidden'] and node['mobileFocus'] == 'false', \
            'Exiting focus left retained chrome inaccessible: ' + selector
    original_bounds, restored_bounds = surface(before, stage)[0]['bounds'], surface(restored, stage)[0]['bounds']
    assert all(abs(original_bounds[key] - restored_bounds[key]) <= 1 for key in ['x', 'y', 'width', 'height']), \
        'The focus transition left offsets or a different visual viewport after return'
    stage_animations = [animation for state in trace['samples'] for animation in state['animations']
        if animation['id'] == 'mineradio-mobile-chrome-stage']
    assert stage_animations and all(animation['duration'] == 560 and animation['properties'] == ['translate']
        for animation in stage_animations), 'Focus did not reuse the bounded 560ms centre-only stage transition'
    for state in trace['samples']:
        live = [animation for animation in state['animations']
            if animation['id'] == 'mineradio-mobile-chrome-stage' and animation['state'] == 'running']
        assert len(live) == len({animation['target']['nodeId'] for animation in live}), \
            'Focus left multiple competing stage animations on the same root'
    assert any(animation['duration'] == 520 and any(value in str(animation['target']['classes'])
        for value in ['local-mobile-header', 'local-mobile-nav', 'local-controls', 'local-current-track'])
        for state in trace['samples'] for animation in state['animations']), \
        'Manual focus chrome did not use the existing 520ms fade transition'
    driver.wake()
    audit.report['checks'].append('Manual focus keeps navigation, metadata and transport instances, then restores the same viewport and usable controls')


def verify_more_over_tool(audit, driver, back=None):
    """A single physical return dismisses only the upper menu, then the tool."""
    tool, more = '[data-testid="local-audio-settings"]', '[data-testid="local-mobile-more"]'
    watched = [tool, more, '.local-mobile-nav', '[data-testid="local-navigation"]']
    audit.selectors = watched
    driver.wake()
    with audit.observe('folia-more-over-tool-layered-return', watched) as trace:
        driver.touch('[data-testid="local-mobile-more-toggle"]', frame=True)
        audit.wait(lambda state: visible(state, more) and settled(state), 'The audio-tool menu did not enter')
        driver.touch('[data-testid="local-open-audio"]', frame=True)
        ready_tool = audit.wait(lambda state: visible(state, tool) and not surface(state, more)
            and state['panel'] == 'open' and settled(state), 'The audio tool did not settle')
        driver.touch('[data-testid="local-mobile-more-toggle"]', frame=True)
        stacked = audit.wait(lambda state: visible(state, more) and visible(state, tool)
            and state['panel'] == 'open' and settled(state), 'More did not open above the retained audio tool')
        if not back:
            audit.page.keyboard.press('Tab')
            assert audit.page.evaluate("""() => {
                const doc = document.getElementById('folia-frame').contentDocument;
                return !!doc.querySelector('[data-testid="local-mobile-more"]')?.contains(doc.activeElement);
            }"""), 'The underlying audio tool stole Tab focus from the More menu'
        if back:
            back()
        else:
            audit.page.keyboard.press('Escape')
        first_return = audit.wait(lambda state: not surface(state, more) and visible(state, tool)
            and state['panel'] == 'open' and settled(state), 'The first return dismissed the audio tool along with More')
        assert surface(first_return, tool)[0]['nodeId'] == surface(ready_tool, tool)[0]['nodeId'], \
            'Closing More remounted the underlying audio tool'
        if back:
            back()
        else:
            audit.page.keyboard.press('Escape')
        second_return = audit.wait(lambda state: not surface(state, tool) and not surface(state, more)
            and state['panel'] == 'closed' and settled(state), 'The second return retained an outgoing audio tool')
    trace['returnDriver'] = 'adb KEYCODE_BACK' if back else 'trusted keyboard Escape'
    trace['returnCommandCount'] = 2
    trace['layers'] = {'readyTool': ready_tool, 'stacked': stacked, 'firstReturn': first_return, 'secondReturn': second_return}
    assert_touch(trace)
    assert_protected_exits(trace, [tool, more])
    if not back:
        escapes = [event for event in trace['events'] if event['type'] == 'keydown' and event['key'] == 'Escape']
        assert len(escapes) == 2 and all(event['isTrusted'] for event in escapes), \
            'The layered return audit did not use exactly two trusted Escape presses'
    else:
        assert len([event for event in trace['events'] if event['type'] == 'mineradio-mobile-back']) == 2, \
            'The layered return audit did not receive exactly two Android back events'
    driver.wake()
    audit.report['checks'].append('One Escape or Android back closes only More above an audio tool; the next return releases the retained tool')


def verify_mobile_motion(page, checks, out, native=False, back=None):
    """Audit high frequency paths; native keeps the same real audio sink outside this helper."""
    name = 'mobile-motion-android' if native else 'mobile-motion-browser'
    report = {'passed': False, 'platform': 'Android WebView' if native else 'Chromium',
        'traces': [], 'checks': [], 'performanceLimit': 'Software GPU traces do not establish physical-device 60FPS.'}
    audit = MotionAudit(page, out, name, report=report)
    driver = TouchDriver(page, report)
    try:
        if not native:
            page.set_viewport_size({'width': 390, 'height': 844})
            assert page.evaluate('typeof MineradioMobileMotion === "object"'), 'Shared mobile motion runtime was not loaded'
            host = ['#playlist-panel', '#fx-panel', '#search-results', '#mobile-nav']
            with audit.observe('host-library-enter', host) as trace:
                driver.touch('#mobile-nav [data-mobile-view="library"]')
                audit.wait(lambda state: state['currentView'] == 'library' and visible(state, '#playlist-panel')
                    and settled(state), 'The library page did not settle')
            assert_touch(trace)
            assert_fade(trace, ['#playlist-panel'])
            assert_stable_size(trace, '#mobile-nav')
            with audit.observe('host-library-settings-player', host) as trace:
                driver.touch('#mobile-nav [data-mobile-view="settings"]')
                driver.touch('#mobile-nav [data-mobile-view="library"]')
                driver.touch('#mobile-nav [data-mobile-view="player"]')
                audit.wait(lambda state: state['currentView'] == 'player' and settled(state)
                    and not visible(state, '#playlist-panel') and not visible(state, '#fx-panel'),
                    'Rapid navigation left a stale page or running animation')
            assert_touch(trace)
            report['checks'].append('Host navigation enters naturally and repeated changes settle without stale pages')

            driver.touch('#mobile-nav [data-mobile-view="library"]')
            audit.wait(lambda state: visible(state, '#playlist-panel') and settled(state), 'Library reopening failed')
            with audit.observe('host-dialog-enter', ['#collect-modal', '#collect-modal .modal']) as trace:
                driver.touch('#pl-pane-create-btn')
                audit.wait(lambda state: visible(state, '#collect-modal') and settled(state), 'Playlist dialog did not enter')
            assert_touch(trace)
            assert_fade(trace, ['#collect-modal', '#collect-modal .modal'])
            with audit.observe('host-dialog-exit', ['#collect-modal', '#collect-modal .modal']) as trace:
                driver.touch('#collect-modal button[onclick="closeCollectModal()"]')
                audit.wait(lambda state: hidden(state, '#collect-modal') and settled(state),
                    'Playlist dialog did not finish closing')
            assert_touch(trace)
            assert_fade(trace, ['#collect-modal', '#collect-modal .modal'])
            driver.touch('#mobile-nav [data-mobile-view="player"]')
            report['checks'].append('Host dialog and mask have visible entry and reverse exit with the page usable afterwards')
            audit.wait(lambda state: state['currentView'] == 'player' and settled(state), 'The player did not settle before More')
            verify_host_more(audit, driver)
            verify_host_queue_removal(audit, driver)
            driver.touch('#mobile-folia-switch')
            page.frame_locator('#folia-frame').get_by_test_id('local-mobile-nav').wait_for(state='attached', timeout=30000)

        audit.frame = True
        driver.wake()
        panels = ['[data-testid="local-library"]', '[data-testid="local-visual-settings"]',
            '[data-testid="local-playback-settings"]', '.local-mobile-nav', '[data-mobile-motion-presence]']
        with audit.observe('folia-library-enter', panels) as trace:
            driver.touch('[data-testid="local-open-library"]', frame=True)
            audit.wait(lambda state: visible(state, '[data-testid="local-library"]') and settled(state),
                'Folia library did not settle')
        assert_touch(trace)
        if not native:
            assert_fade(trace, ['[data-testid="local-library"]', '[data-mobile-motion-presence]'])
        assert_stable_size(trace, '.local-mobile-nav')
        with audit.observe('folia-library-return', panels) as trace:
            if back:
                back()
            else:
                driver.touch('[data-testid="local-library"] .local-panel-title>button', frame=True)
            audit.wait(lambda state: not surface(state, '[data-testid="local-library"]')
                and state['panel'] == 'closed' and settled(state), 'Return left retained Folia content or stale panel state')
        if not back:
            assert_touch(trace)
        trace['returnDriver'] = 'adb KEYCODE_BACK' if back else 'trusted close-button touch'
        if not native:
            assert_fade(trace, ['[data-testid="local-library"]', '[data-mobile-motion-presence]'])
        report['checks'].append('Folia library enters and returns with bounded presence and restored interaction')

        driver.wake()
        with audit.observe('folia-rapid-panels', panels) as trace:
            driver.touch('[data-testid="local-open-library"]', frame=True)
            driver.touch('[data-testid="local-open-settings"]', frame=True)
            driver.touch('[data-testid="local-open-library"]', frame=True)
            driver.touch('.local-mobile-nav>button:first-child', frame=True)
            audit.wait(lambda state: state['panel'] == 'closed' and settled(state)
                and not surface(state, '[data-testid="local-library"]')
                and not surface(state, '[data-testid="local-visual-settings"]'),
                'Repeated Folia panel changes left an outgoing surface mounted')
        assert_touch(trace)
        trace['interruptionObserved'] = any(any(animation['currentTime'] is not None
            and isinstance(animation['duration'], (int, float))
            and isinstance(animation['currentTime'], (int, float))
            and 0 < animation['currentTime'] < animation['duration']
            for animation in event['animations']) for event in trace['events'] if event['type'] == 'pointerdown')
        report['checks'].append('Rapid Folia panel changes finish with no stale presence or blocked bottom navigation')

        verify_folia_focus(audit, driver)
        verify_more_over_tool(audit, driver, back=back)

        if not native:
            driver.wake()
            with audit.observe('folia-pressed-cancel', ['[data-testid="local-open-library"]']) as trace:
                driver.touch('[data-testid="local-open-library"]', frame=True, hold=100, cancel=True)
                audit.wait(lambda state: state['panel'] == 'closed' and settled(state), 'Cancelled press opened a panel')
            assert_touch(trace)
            assert any(node['scale'] not in ['none', '1', '1 1'] or node['transform'] != 'none'
                for state in trace['samples'] for node in state['surfaces']), 'No button press feedback was observed'
            assert any(event['type'] == 'pointercancel' and event['isTrusted'] for event in trace['events'])
            report['checks'].append('Trusted press and cancellation show feedback without executing the action')

            views = ['[data-testid="local-visualizer"]', '[data-testid="local-record-wall"]',
                '[data-testid="local-poster-wall"]', '.local-mobile-nav', '[data-mobile-motion-view]']
            for view, selector in [('records', '[data-testid="local-record-wall"]'),
                    ('posters', '[data-testid="local-poster-wall"]'), ('lyrics', '[data-testid="local-visualizer"]')]:
                driver.wake()
                with audit.observe('folia-view-' + view, views) as trace:
                    driver.touch('[data-testid="local-view-' + view + '"]', frame=True)
                    audit.wait(lambda state: state['currentView'] == view and visible(state, selector) and settled(state),
                        'Folia view did not settle: ' + view, timeout=8)
                assert_touch(trace)
                assert_fade(trace, [selector, '[data-mobile-motion-view]'])
                assert_stable_size(trace, '.local-mobile-nav')
            report['checks'].append('All three Folia views transition while bottom navigation keeps its geometry')

            driver.wake()
            with audit.observe('folia-menu-enter-exit', ['[data-testid="local-mobile-more"]', '[data-mobile-motion-presence]']) as trace:
                driver.touch('[data-testid="local-mobile-more-toggle"]', frame=True)
                audit.wait(lambda state: visible(state, '[data-testid="local-mobile-more"]') and settled(state),
                    'More menu did not enter')
                driver.touch('[data-testid="local-mobile-more-toggle"]', frame=True)
                audit.wait(lambda state: not surface(state, '[data-testid="local-mobile-more"]') and settled(state),
                    'More menu did not finish closing')
            assert_touch(trace)
            assert_fade(trace, ['[data-testid="local-mobile-more"]', '[data-mobile-motion-presence]'])
            report['checks'].append('The mobile More sheet enters and exits continuously')

        driver.wake()
        with audit.observe('reduce-motion-during-entry', panels) as trace:
            driver.touch('[data-testid="local-open-library"]', frame=True)
            before_preference = audit.snapshot()
            preference_started = time.monotonic()
            page.emulate_media(reduced_motion='reduce')
            preference_duration = (time.monotonic() - preference_started) * 1000
            audit.wait(lambda state: state['reducedMotion'] and visible(state, '[data-testid="local-library"]')
                and settled(state), 'Reduce Motion did not finish the active Folia transition')
            driver.touch('[data-testid="local-library"] .local-panel-title>button', frame=True)
            audit.wait(lambda state: not surface(state, '[data-testid="local-library"]') and settled(state),
                'Reduced-motion closing retained the Folia panel')
        assert_touch(trace)
        trace['preferenceChangeBefore'] = before_preference
        trace['preferenceCallDurationMs'] = preference_duration
        trace['preferenceChangeObservedDuringMotion'] = any(animation['state'] == 'running'
            and isinstance(animation['currentTime'], (int, float))
            and isinstance(animation['duration'], (int, float))
            and 0 < animation['currentTime'] < animation['duration']
            for animation in before_preference['animations'])
        assert page.evaluate('matchMedia("(prefers-reduced-motion: reduce)").matches'), \
            'The host did not receive the changed system motion preference'
        report['checks'].append('Dynamic Reduce Motion settles Folia UI transitions and releases presence')
        page.emulate_media(reduced_motion='no-preference')
        audit.wait(lambda state: not state['reducedMotion'] and settled(state), 'Normal motion preference did not restore')
        driver.wake()
        if not native:
            driver.touch('[data-testid="local-mobile-return"]', frame=True)
            page.wait_for_function('!document.body.classList.contains("folia-interface-active")')
            audit.frame = False
            with audit.observe('host-reduce-motion-cleanup', ['#fx-panel', '#playlist-panel', '#mobile-nav']) as trace:
                driver.touch('#mobile-nav [data-mobile-view="settings"]')
                page.emulate_media(reduced_motion='reduce')
                audit.wait(lambda state: state['reducedMotion'] and visible(state, '#fx-panel') and settled(state)
                    and state['diagnostics'] and state['diagnostics']['reducedMotion'] is True,
                    'The shared host runtime did not adopt Reduce Motion')
                driver.touch('#mobile-nav [data-mobile-view="player"]')
                audit.wait(lambda state: state['currentView'] == 'player' and settled(state)
                    and state['diagnostics']['activeAnimations'] == 0, 'Host motion tasks did not finish and clear')
            assert_touch(trace)
            report['checks'].append('Host media preference changes and finite animation tasks are cleaned up')
        report['passed'] = True
        if not native:
            checks.append('mobile motion: ' + '; '.join(report['checks']))
    except Exception as error:
        report['failure'] = str(error)
        raise
    finally:
        page.emulate_media(reduced_motion='no-preference')
        driver.close()
        audit.save()


def verify_motion_list(browser, checks, out):
    """Use 96 real imported WAVs in a fresh cloud context, retaining the 60-row page boundary."""
    context = browser.new_context(viewport={'width': 390, 'height': 844},
        is_mobile=True, has_touch=True, device_scale_factor=1)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    report = {'passed': False, 'fixtureTracks': 96, 'pageLimit': 60, 'exitLimit': 0,
        'totalLimit': 60, 'animationLimit': 8,
        'traces': [], 'checks': [], 'errors': errors}
    audit = MotionAudit(page, out, 'mobile-motion-list', frame=True, report=report)
    driver = TouchDriver(page, report)
    try:
        buffer = io.BytesIO()
        with wave.open(buffer, 'wb') as track:
            track.setparams((1, 2, 8000, 0, 'NONE', 'not compressed'))
            track.writeframes(b''.join(struct.pack('<h', int(180 * math.sin(2 * math.pi * 220 * n / 8000)))
                for n in range(24000)))
        data = buffer.getvalue()
        page.goto('http://127.0.0.1:3077')
        page.wait_for_load_state('networkidle', timeout=30000)
        page.locator('#file-input').set_input_files([
            {'name': f'Motion-{index:03}.wav', 'mimeType': 'audio/wav', 'buffer': data}
            for index in range(1, 97)])
        page.wait_for_function('localLibrarySongs.length === 96', timeout=45000)
        # This context owns only test fixtures. Keep short fixture playback out of
        # the list stress test so end-of-track updates do not obscure its traces.
        page.evaluate('audio.pause()')
        driver.touch('#mobile-folia-switch')
        page.frame_locator('#folia-frame').get_by_test_id('local-mobile-nav').wait_for(state='attached', timeout=30000)
        driver.wake()
        rows = ['[data-testid="local-library"]', '.local-track-list', '[data-testid="local-track-row"]']
        with audit.observe('96-tracks-first-page', rows) as trace:
            driver.touch('[data-testid="local-open-library"]', frame=True)
            audit.wait(lambda state: state['rowCount'] == 60 and state['activeRowCount'] == 60 and settled(state)
                and visible(state, '[data-testid="local-track-row"]')
                and visible(state, '[data-testid="local-library"]'), 'The 96-track fixture did not load a bounded first page', timeout=15)
        assert_touch(trace)
        assert_list_bounds(trace)
        delays = [animation['delay'] for state in trace['samples'] for animation in state['animations'] if animation['rowRoot']]
        assert delays and max(delays) <= 84, 'List entry must use a bounded, short stagger'
        report['checks'].append('96 real files retain one list with at most 60 total/current/interactive rows, zero exit leases and eight animated row roots')

        before_scroll = page.frame_locator('#folia-frame').locator('.local-track-list').evaluate('(node) => node.scrollTop')
        with audit.observe('list-touch-scroll', ['.local-track-list', '[data-testid="local-track-row"]']) as trace:
            driver.swipe('.local-track-list', frame=True)
            audit.wait(lambda state: settled(state), 'Scrolling started an unbounded list animation')
        after_scroll = page.frame_locator('#folia-frame').locator('.local-track-list').evaluate('(node) => node.scrollTop')
        assert after_scroll > before_scroll + 20, 'The list did not scroll under a real swipe'
        assert max(state['rowAnimationCount'] for state in trace['samples']) == 0, 'Scrolling replayed row entry animations'
        assert_touch(trace)
        assert_list_bounds(trace, stable_root=True)
        report['checks'].append('Touch scrolling moves the list without replaying row introductions')

        with audit.observe('list-next-page', ['.local-track-list', '[data-testid="local-track-row"]']) as trace:
            driver.touch('[data-testid="local-next-page"]', frame=True)
            audit.wait(lambda state: state['rowCount'] == 36 and state['activeRowCount'] == 36 and settled(state)
                and visible(state, '[data-testid="local-track-row"]'),
                'The second page did not render exactly the remaining 36 tracks')
        assert_touch(trace)
        assert_list_bounds(trace, stable_root=True)
        report['checks'].append('Pagination preserves one list DOM node and loads exactly the remaining 36 interactive tracks')

        with audit.observe('list-query-refresh', ['.local-track-list', '[data-testid="local-track-row"]']) as trace:
            page.frame_locator('#folia-frame').get_by_test_id('local-search').fill('Motion-090')
            audit.wait(lambda state: state['rowCount'] == 1 and state['activeRowCount'] == 1 and settled(state)
                and visible(state, '[data-testid="local-track-row"]'), 'Searching the long list did not finish')
        assert_list_bounds(trace, stable_root=True)
        report['checks'].append('Filtering preserves the list container while replacing its bounded content')
        assert not errors, errors
        report['passed'] = True
        checks.append('mobile motion long list: 96 real WAVs, bounded entries, real scrolling and stable refresh')
    except Exception as error:
        report['failure'] = str(error)
        raise
    finally:
        driver.close()
        audit.save()
        context.close()
