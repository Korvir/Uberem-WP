//Smooth scroll plugin
(function () {
    var defaultOptions = {
        frameRate: 150,
        animationTime: 400,
        stepSize: 100,
        pulseAlgorithm: true,
        pulseScale: 4,
        pulseNormalize: 1,
        accelerationDelta: 50,
        accelerationMax: 3,
        keyboardSupport: true,
        arrowScroll: 50,
        touchpadSupport: false,
        fixedBackground: true,
        excluded: ""
    };
    var options = defaultOptions;
    var isExcluded = false;
    var isFrame = false;
    var direction = {x: 0, y: 0};
    var initDone = false;
    var root = document.documentElement;
    var activeElement;
    var observer;
    var refreshSize;
    var deltaBuffer = [];
    var isMac = /^Mac/.test(navigator.platform);
    var key = {left: 37, up: 38, right: 39, down: 40, spacebar: 32, pageup: 33, pagedown: 34, end: 35, home: 36};

    function initTest() {
        if (options.keyboardSupport) {
            addEvent("keydown", keydown)
        }
    }

    function init() {
        if (initDone || !document.body) return;
        initDone = true;
        var body = document.body;
        var html = document.documentElement;
        var windowHeight = window.innerHeight;
        var scrollHeight = body.scrollHeight;
        root = document.compatMode.indexOf("CSS") >= 0 ? html : body;
        activeElement = body;
        initTest();
        if (top != self) {
            isFrame = true
        } else if (scrollHeight > windowHeight && (body.offsetHeight <= windowHeight || html.offsetHeight <= windowHeight)) {
            var fullPageElem = document.createElement("div");
            fullPageElem.style.cssText = "position:absolute; z-index:-10000; " + "top:0; left:0; right:0; height:" + root.scrollHeight + "px";
            document.body.appendChild(fullPageElem);
            var pendingRefresh;
            refreshSize = function () {
                if (pendingRefresh) return;
                pendingRefresh = setTimeout(function () {
                    if (isExcluded) return;
                    fullPageElem.style.height = "0";
                    fullPageElem.style.height = root.scrollHeight + "px";
                    pendingRefresh = null
                }, 500)
            };
            setTimeout(refreshSize, 10);
            addEvent("resize", refreshSize);
            var config = {attributes: true, childList: true, characterData: false};
            observer = new MutationObserver(refreshSize);
            observer.observe(body, config);
            if (root.offsetHeight <= windowHeight) {
                var clearfix = document.createElement("div");
                clearfix.style.clear = "both";
                body.appendChild(clearfix)
            }
        }
        if (!options.fixedBackground && !isExcluded) {
            body.style.backgroundAttachment = "scroll";
            html.style.backgroundAttachment = "scroll"
        }
    }

    function cleanup() {
        observer && observer.disconnect();
        removeEvent(wheelEvent, wheel);
        removeEvent("mousedown", mousedown);
        removeEvent("keydown", keydown);
        removeEvent("resize", refreshSize);
        removeEvent("load", init)
    }

    var que = [];
    var pending = false;
    var lastScroll = Date.now();

    function scrollArray(elem, left, top) {
        directionCheck(left, top);
        if (options.accelerationMax != 1) {
            var now = Date.now();
            var elapsed = now - lastScroll;
            if (elapsed < options.accelerationDelta) {
                var factor = (1 + 50 / elapsed) / 2;
                if (factor > 1) {
                    factor = Math.min(factor, options.accelerationMax);
                    left *= factor;
                    top *= factor
                }
            }
            lastScroll = Date.now()
        }
        que.push({x: left, y: top, lastX: left < 0 ? .99 : -.99, lastY: top < 0 ? .99 : -.99, start: Date.now()});
        if (pending) {
            return
        }
        var scrollWindow = elem === document.body;
        var step = function (time) {
            var now = Date.now();
            var scrollX = 0;
            var scrollY = 0;
            for (var i = 0; i < que.length; i++) {
                var item = que[i];
                var elapsed = now - item.start;
                var finished = elapsed >= options.animationTime;
                var position = finished ? 1 : elapsed / options.animationTime;
                if (options.pulseAlgorithm) {
                    position = pulse(position)
                }
                var x = item.x * position - item.lastX >> 0;
                var y = item.y * position - item.lastY >> 0;
                scrollX += x;
                scrollY += y;
                item.lastX += x;
                item.lastY += y;
                if (finished) {
                    que.splice(i, 1);
                    i--
                }
            }
            if (scrollWindow) {
                window.scrollBy(scrollX, scrollY)
            } else {
                if (scrollX) elem.scrollLeft += scrollX;
                if (scrollY) elem.scrollTop += scrollY
            }
            if (!left && !top) {
                que = []
            }
            if (que.length) {
                requestFrame(step, elem, 1e3 / options.frameRate + 1)
            } else {
                pending = false
            }
        };
        requestFrame(step, elem, 0);
        pending = true
    }

    function wheel(event) {
        if (!initDone) {
            init()
        }
        var target = event.target;
        var overflowing = overflowingAncestor(target);
        if (!overflowing || event.defaultPrevented || event.ctrlKey) {
            return true
        }
        if (isNodeName(activeElement, "embed") || isNodeName(target, "embed") && /\.pdf/i.test(target.src) || isNodeName(activeElement, "object")) {
            return true
        }
        var deltaX = -event.wheelDeltaX || event.deltaX || 0;
        var deltaY = -event.wheelDeltaY || event.deltaY || 0;
        if (isMac) {
            if (event.wheelDeltaX && isDivisible(event.wheelDeltaX, 120)) {
                deltaX = -120 * (event.wheelDeltaX / Math.abs(event.wheelDeltaX))
            }
            if (event.wheelDeltaY && isDivisible(event.wheelDeltaY, 120)) {
                deltaY = -120 * (event.wheelDeltaY / Math.abs(event.wheelDeltaY))
            }
        }
        if (!deltaX && !deltaY) {
            deltaY = -event.wheelDelta || 0
        }
        if (event.deltaMode === 1) {
            deltaX *= 40;
            deltaY *= 40
        }
        if (!options.touchpadSupport && isTouchpad(deltaY)) {
            return true
        }
        if (Math.abs(deltaX) > 1.2) {
            deltaX *= options.stepSize / 120
        }
        if (Math.abs(deltaY) > 1.2) {
            deltaY *= options.stepSize / 120
        }
        scrollArray(overflowing, deltaX, deltaY);
        event.preventDefault();
        scheduleClearCache()
    }

    function keydown(event) {
        var target = event.target;
        var modifier = event.ctrlKey || event.altKey || event.metaKey || event.shiftKey && event.keyCode !== key.spacebar;
        if (!document.body.contains(activeElement)) {
            activeElement = document.activeElement
        }
        var inputNodeNames = /^(textarea|select|embed|object)$/i;
        var buttonTypes = /^(button|submit|radio|checkbox|file|color|image)$/i;
        if (inputNodeNames.test(target.nodeName) || isNodeName(target, "input") && !buttonTypes.test(target.type) || isNodeName(activeElement, "video") || isInsideYoutubeVideo(event) || target.isContentEditable || event.defaultPrevented || modifier) {
            return true
        }
        if ((isNodeName(target, "button") || isNodeName(target, "input") && buttonTypes.test(target.type)) && event.keyCode === key.spacebar) {
            return true
        }
        var shift, x = 0, y = 0;
        var elem = overflowingAncestor(activeElement);
        var clientHeight = elem.clientHeight;
        if (elem == document.body) {
            clientHeight = window.innerHeight
        }
        switch (event.keyCode) {
            case key.up:
                y = -options.arrowScroll;
                break;
            case key.down:
                y = options.arrowScroll;
                break;
            case key.spacebar:
                shift = event.shiftKey ? 1 : -1;
                y = -shift * clientHeight * .9;
                break;
            case key.pageup:
                y = -clientHeight * .9;
                break;
            case key.pagedown:
                y = clientHeight * .9;
                break;
            case key.home:
                y = -elem.scrollTop;
                break;
            case key.end:
                var damt = elem.scrollHeight - elem.scrollTop - clientHeight;
                y = damt > 0 ? damt + 10 : 0;
                break;
            case key.left:
                x = -options.arrowScroll;
                break;
            case key.right:
                x = options.arrowScroll;
                break;
            default:
                return true
        }
        scrollArray(elem, x, y);
        event.preventDefault();
        scheduleClearCache()
    }

    function mousedown(event) {
        activeElement = event.target
    }

    var uniqueID = function () {
        var i = 0;
        return function (el) {
            return el.uniqueID || (el.uniqueID = i++)
        }
    }();
    var cache = {};
    var clearCacheTimer;

    function scheduleClearCache() {
        clearTimeout(clearCacheTimer);
        clearCacheTimer = setInterval(function () {
            cache = {}
        }, 1 * 1e3)
    }

    function setCache(elems, overflowing) {
        for (var i = elems.length; i--;) cache[uniqueID(elems[i])] = overflowing;
        return overflowing
    }

    function overflowingAncestor(el) {
        var elems = [];
        var body = document.body;
        var rootScrollHeight = root.scrollHeight;
        do {
            var cached = cache[uniqueID(el)];
            if (cached) {
                return setCache(elems, cached)
            }
            elems.push(el);
            if (rootScrollHeight === el.scrollHeight) {
                var topOverflowsNotHidden = overflowNotHidden(root) && overflowNotHidden(body);
                var isOverflowCSS = topOverflowsNotHidden || overflowAutoOrScroll(root);
                if (isFrame && isContentOverflowing(root) || !isFrame && isOverflowCSS) {
                    return setCache(elems, getScrollRoot())
                }
            } else if (isContentOverflowing(el) && overflowAutoOrScroll(el)) {
                return setCache(elems, el)
            }
        } while (el = el.parentElement)
    }

    function isContentOverflowing(el) {
        return el.clientHeight + 10 < el.scrollHeight
    }

    function overflowNotHidden(el) {
        var overflow = getComputedStyle(el, "").getPropertyValue("overflow-y");
        return overflow !== "hidden"
    }

    function overflowAutoOrScroll(el) {
        var overflow = getComputedStyle(el, "").getPropertyValue("overflow-y");
        return overflow === "scroll" || overflow === "auto"
    }

    function addEvent(type, fn,options) {
        options = options || false;
        window.addEventListener(type, fn, options)
    }

    function removeEvent(type, fn) {
        window.removeEventListener(type, fn, false)
    }

    function isNodeName(el, tag) {
        return (el.nodeName || "").toLowerCase() === tag.toLowerCase()
    }

    function directionCheck(x, y) {
        x = x > 0 ? 1 : -1;
        y = y > 0 ? 1 : -1;
        if (direction.x !== x || direction.y !== y) {
            direction.x = x;
            direction.y = y;
            que = [];
            lastScroll = 0
        }
    }

    var deltaBufferTimer;
    if (window.localStorage && localStorage.SS_deltaBuffer) {
        deltaBuffer = localStorage.SS_deltaBuffer.split(",")
    }

    function isTouchpad(deltaY) {
        if (!deltaY) return;
        if (!deltaBuffer.length) {
            deltaBuffer = [deltaY, deltaY, deltaY]
        }
        deltaY = Math.abs(deltaY);
        deltaBuffer.push(deltaY);
        deltaBuffer.shift();
        clearTimeout(deltaBufferTimer);
        deltaBufferTimer = setTimeout(function () {
            if (window.localStorage) {
                localStorage.SS_deltaBuffer = deltaBuffer.join(",")
            }
        }, 1e3);
        return !allDeltasDivisableBy(120) && !allDeltasDivisableBy(100)
    }

    function isDivisible(n, divisor) {
        return Math.floor(n / divisor) == n / divisor
    }

    function allDeltasDivisableBy(divisor) {
        return isDivisible(deltaBuffer[0], divisor) && isDivisible(deltaBuffer[1], divisor) && isDivisible(deltaBuffer[2], divisor)
    }

    function isInsideYoutubeVideo(event) {
        var elem = event.target;
        var isControl = false;
        if (document.URL.indexOf("www.youtube.com/watch") != -1) {
            do {
                isControl = elem.classList && elem.classList.contains("html5-video-controls");
                if (isControl) break
            } while (elem = elem.parentNode)
        }
        return isControl
    }

    var requestFrame = function () {
        return window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || function (callback, element, delay) {
            window.setTimeout(callback, delay || 1e3 / 60)
        }
    }();
    var MutationObserver = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver;
    var getScrollRoot = function () {
        var SCROLL_ROOT;
        return function () {
            if (!SCROLL_ROOT) {
                var dummy = document.createElement("div");
                dummy.style.cssText = "height:10000px;width:1px;";
                document.body.appendChild(dummy);
                var bodyScrollTop = document.body.scrollTop;
                var docElScrollTop = document.documentElement.scrollTop;
                window.scrollBy(0, 3);
                if (document.body.scrollTop != bodyScrollTop) SCROLL_ROOT = document.body; else SCROLL_ROOT = document.documentElement;
                window.scrollBy(0, -3);
                document.body.removeChild(dummy)
            }
            return SCROLL_ROOT
        }
    }();

    function pulse_(x) {
        var val, start, expx;
        x = x * options.pulseScale;
        if (x < 1) {
            val = x - (1 - Math.exp(-x))
        } else {
            start = Math.exp(-1);
            x -= 1;
            expx = 1 - Math.exp(-x);
            val = start + expx * (1 - start)
        }
        return val * options.pulseNormalize
    }

    function pulse(x) {
        if (x >= 1) return 1;
        if (x <= 0) return 0;
        if (options.pulseNormalize == 1) {
            options.pulseNormalize /= pulse_(1)
        }
        return pulse_(x)
    }

    var userAgent = window.navigator.userAgent;
    var isEdge = /Edge/.test(userAgent);
    var isChrome = /chrome/i.test(userAgent) && !isEdge;
    var isSafari = /safari/i.test(userAgent) && !isEdge;
    var isMobile = /mobile/i.test(userAgent);
    var isIEWin7 = /Windows NT 6.1/i.test(userAgent) && /rv:11/i.test(userAgent);
    var isEnabledForBrowser = (isChrome || isSafari || isIEWin7) && !isMobile;
    var wheelEvent;
    if ("onwheel" in document.createElement("div")) wheelEvent = "wheel"; else if ("onmousewheel" in document.createElement("div")) wheelEvent = "mousewheel";
    if (wheelEvent && isEnabledForBrowser) {
        var supportsPassive = false;
        try {
            var opts = Object.defineProperty({}, 'passive', {
                get: function() {
                    supportsPassive = true;
                }
            });
            window.addEventListener("testPassive", null, opts);
            window.removeEventListener("testPassive", null, opts);
        } catch (e) {}
        addEvent(wheelEvent, wheel,supportsPassive ? { passive: false } : false);
        addEvent("mousedown", mousedown);
        addEvent("load", init)
    }

    function SmoothScroll(optionsToSet) {
        for (var key in optionsToSet) if (defaultOptions.hasOwnProperty(key)) options[key] = optionsToSet[key]
    }

    SmoothScroll.destroy = cleanup;
    if (window.SmoothScrollOptions) SmoothScroll(window.SmoothScrollOptions);
    if (typeof define === "function" && define.amd) define(function () {
        return SmoothScroll
    }); else if ("object" == typeof exports) module.exports = SmoothScroll; else window.SmoothScroll = SmoothScroll
})();

//Comments reply
var addComment = {
    moveForm: function (e, t, n, o) {
        var r, i, d, m, l = this, a = l.I(e), c = l.I(n), s = l.I("cancel-comment-reply-link"),
            p = l.I("comment_parent"), f = l.I("comment_post_ID"), u = c.getElementsByTagName("form")[0];
        if (a && c && s && p && u) {
            l.respondId = n, o = o || !1, l.I("wp-temp-form-div") || ((r = document.createElement("div")).id = "wp-temp-form-div", r.style.display = "none", c.parentNode.insertBefore(r, c)), a.parentNode.insertBefore(c, a.nextSibling), f && o && (f.value = o), p.value = t, s.style.display = "", s.onclick = function () {
                var e = addComment, t = e.I("wp-temp-form-div"), n = e.I(e.respondId);
                if (t && n) return e.I("comment_parent").value = "0", t.parentNode.insertBefore(n, t), t.parentNode.removeChild(t), this.style.display = "none", this.onclick = null, !1
            };
            try {
                for (var y = 0; y < u.elements.length; y++) if (i = u.elements[y], m = !1, "getComputedStyle" in window ? d = window.getComputedStyle(i) : document.documentElement.currentStyle && (d = i.currentStyle), (i.offsetWidth <= 0 && i.offsetHeight <= 0 || "hidden" === d.visibility) && (m = !0), "hidden" !== i.type && !i.disabled && !m) {
                    i.focus();
                    break
                }
            } catch (e) {
            }
            return !1
        }
    }, I: function (e) {
        return document.getElementById(e)
    }
};

//Image marker
!function (t) {

    var i = {
        width: 0,
        height: 0,
        selector: ".marker-point",
        onInit: null,
        getSelectorElement: null,
        getValueRemove: null
    }, e = {
        settings: null, init: function (a, o) {
            this.settings = t.extend(i, o), this.event(a), e.layout(a), t(window).on("resize", function () {
                e.layout(a)
            })
        }, event: function (i) {
            t.isFunction(this.settings.onInit) && this.settings.onInit(), t(i).each(function () {
                var i = t(this).find(".marker-point");
                i.wrapAll("<div class='marker-wrap' />"), i.parent().append("<div class='marker-mask'></div>")
            }), t("#works-section .marker-point").mouseenter(function () {
                t(t(this).data("popover")).css("visibility", "visible").hide().fadeIn()
            }).mouseleave(function () {
                t(t(this).data("popover")).stop().fadeOut()
            }).click(function () {
                t(this).closest(".marker-img-wrap").find(".marker-tooltip:visible").stop().fadeOut(), t(t(this).data("popover")).css("visibility", "visible").hide().fadeIn()
            }), t("#works-section .marker-mask").on("click", function () {
                t(this).closest(".marker-img-wrap").find(".marker-tooltip:visible").fadeOut()
            })
        }, layout: function (i) {
            i.each(function () {
                var i = t(this), e = new Image;
                e.src = i.find(".marker-target").attr("src");
                //this is image size (marked) added for right calculation
                var a = 1140, o = 612, n = i.width() / a * 100, r = o * n / 100;
                i.css({height: r}), i.find(".marker-point").each(function () {
                    var e, o, r = t(this);
                    i.width() < a ? (e = r.data("top") * n / 100, o = r.data("left") * n / 100) : (e = r.data("top"), o = r.data("left")), r.css({
                        top: e + "px",
                        left: o + "px"
                    });
                    var s = t(t(this).data("popover")), l = e + 64, c = r.parent().height(), d = r.parent().width(),
                        p = s.outerHeight(), h = s.outerWidth() / 2 + 30;
                    s.removeClass("marker-tooltip-bottom marker-tooltip-left marker-tooltip-right"), p + l > c && (l = e - p - 16, s.addClass("marker-tooltip-bottom")), h > o && s.addClass("marker-tooltip-left"), h + o > d && s.addClass("marker-tooltip-right"), s.css({
                        left: o,
                        top: l
                    })
                })
            })
        }
    };
    t.fn.scalize = function (t) {
        return e.init(this, t)
    }
}(jQuery);

//Slick slider v1.8.1
!function (i) {
    "use strict";
    "function" == typeof define && define.amd ? define(["jquery"], i) : "undefined" != typeof exports ? module.exports = i(require("jquery")) : i(jQuery)
}(function (i) {
    "use strict";
    var e = window.Slick || {};
    (e = function () {
        var e = 0;
        return function (t, o) {
            var s, n = this;
            n.defaults = {
                accessibility: !0,
                adaptiveHeight: !1,
                appendArrows: i(t),
                appendDots: i(t),
                arrows: !0,
                asNavFor: null,
                prevArrow: '<button class="slick-prev" aria-label="Previous" type="button">Previous</button>',
                nextArrow: '<button class="slick-next" aria-label="Next" type="button">Next</button>',
                autoplay: !1,
                autoplaySpeed: 3e3,
                centerMode: !1,
                centerPadding: "50px",
                cssEase: "ease",
                customPaging: function (e, t) {
                    return i('<button type="button" />').text(t + 1)
                },
                dots: !1,
                dotsClass: "slick-dots",
                draggable: !0,
                easing: "linear",
                edgeFriction: .35,
                fade: !1,
                focusOnSelect: !1,
                focusOnChange: !1,
                infinite: !0,
                initialSlide: 0,
                lazyLoad: "ondemand",
                mobileFirst: !1,
                pauseOnHover: !0,
                pauseOnFocus: !0,
                pauseOnDotsHover: !1,
                respondTo: "window",
                responsive: null,
                rows: 1,
                rtl: !1,
                slide: "",
                slidesPerRow: 1,
                slidesToShow: 1,
                slidesToScroll: 1,
                speed: 500,
                swipe: !0,
                swipeToSlide: !1,
                touchMove: !0,
                touchThreshold: 5,
                useCSS: !0,
                useTransform: !0,
                variableWidth: !1,
                vertical: !1,
                verticalSwiping: !1,
                waitForAnimate: !0,
                zIndex: 1e3
            }, n.initials = {
                animating: !1,
                dragging: !1,
                autoPlayTimer: null,
                currentDirection: 0,
                currentLeft: null,
                currentSlide: 0,
                direction: 1,
                $dots: null,
                listWidth: null,
                listHeight: null,
                loadIndex: 0,
                $nextArrow: null,
                $prevArrow: null,
                scrolling: !1,
                slideCount: null,
                slideWidth: null,
                $slideTrack: null,
                $slides: null,
                sliding: !1,
                slideOffset: 0,
                swipeLeft: null,
                swiping: !1,
                $list: null,
                touchObject: {},
                transformsEnabled: !1,
                unslicked: !1
            }, i.extend(n, n.initials), n.activeBreakpoint = null, n.animType = null, n.animProp = null, n.breakpoints = [], n.breakpointSettings = [], n.cssTransitions = !1, n.focussed = !1, n.interrupted = !1, n.hidden = "hidden", n.paused = !0, n.positionProp = null, n.respondTo = null, n.rowCount = 1, n.shouldClick = !0, n.$slider = i(t), n.$slidesCache = null, n.transformType = null, n.transitionType = null, n.visibilityChange = "visibilitychange", n.windowWidth = 0, n.windowTimer = null, s = i(t).data("slick") || {}, n.options = i.extend({}, n.defaults, o, s), n.currentSlide = n.options.initialSlide, n.originalSettings = n.options, void 0 !== document.mozHidden ? (n.hidden = "mozHidden", n.visibilityChange = "mozvisibilitychange") : void 0 !== document.webkitHidden && (n.hidden = "webkitHidden", n.visibilityChange = "webkitvisibilitychange"), n.autoPlay = i.proxy(n.autoPlay, n), n.autoPlayClear = i.proxy(n.autoPlayClear, n), n.autoPlayIterator = i.proxy(n.autoPlayIterator, n), n.changeSlide = i.proxy(n.changeSlide, n), n.clickHandler = i.proxy(n.clickHandler, n), n.selectHandler = i.proxy(n.selectHandler, n), n.setPosition = i.proxy(n.setPosition, n), n.swipeHandler = i.proxy(n.swipeHandler, n), n.dragHandler = i.proxy(n.dragHandler, n), n.keyHandler = i.proxy(n.keyHandler, n), n.instanceUid = e++, n.htmlExpr = /^(?:\s*(<[\w\W]+>)[^>]*)$/, n.registerBreakpoints(), n.init(!0)
        }
    }()).prototype.activateADA = function () {
        this.$slideTrack.find(".slick-active").attr({"aria-hidden": "false"}).find("a, input, button, select").attr({tabindex: "0"})
    }, e.prototype.addSlide = e.prototype.slickAdd = function (e, t, o) {
        var s = this;
        if ("boolean" == typeof t) o = t, t = null; else if (t < 0 || t >= s.slideCount) return !1;
        s.unload(), "number" == typeof t ? 0 === t && 0 === s.$slides.length ? i(e).appendTo(s.$slideTrack) : o ? i(e).insertBefore(s.$slides.eq(t)) : i(e).insertAfter(s.$slides.eq(t)) : !0 === o ? i(e).prependTo(s.$slideTrack) : i(e).appendTo(s.$slideTrack), s.$slides = s.$slideTrack.children(this.options.slide), s.$slideTrack.children(this.options.slide).detach(), s.$slideTrack.append(s.$slides), s.$slides.each(function (e, t) {
            i(t).attr("data-slick-index", e)
        }), s.$slidesCache = s.$slides, s.reinit()
    }, e.prototype.animateHeight = function () {
        var i = this;
        if (1 === i.options.slidesToShow && !0 === i.options.adaptiveHeight && !1 === i.options.vertical) {
            var e = i.$slides.eq(i.currentSlide).outerHeight(!0);
            i.$list.animate({height: e}, i.options.speed)
        }
    }, e.prototype.animateSlide = function (e, t) {
        var o = {}, s = this;
        s.animateHeight(), !0 === s.options.rtl && !1 === s.options.vertical && (e = -e), !1 === s.transformsEnabled ? !1 === s.options.vertical ? s.$slideTrack.animate({left: e}, s.options.speed, s.options.easing, t) : s.$slideTrack.animate({top: e}, s.options.speed, s.options.easing, t) : !1 === s.cssTransitions ? (!0 === s.options.rtl && (s.currentLeft = -s.currentLeft), i({animStart: s.currentLeft}).animate({animStart: e}, {
            duration: s.options.speed,
            easing: s.options.easing,
            step: function (i) {
                i = Math.ceil(i), !1 === s.options.vertical ? (o[s.animType] = "translate(" + i + "px, 0px)", s.$slideTrack.css(o)) : (o[s.animType] = "translate(0px," + i + "px)", s.$slideTrack.css(o))
            },
            complete: function () {
                t && t.call()
            }
        })) : (s.applyTransition(), e = Math.ceil(e), !1 === s.options.vertical ? o[s.animType] = "translate3d(" + e + "px, 0px, 0px)" : o[s.animType] = "translate3d(0px," + e + "px, 0px)", s.$slideTrack.css(o), t && setTimeout(function () {
            s.disableTransition(), t.call()
        }, s.options.speed))
    }, e.prototype.getNavTarget = function () {
        var e = this.options.asNavFor;
        return e && null !== e && (e = i(e).not(this.$slider)), e
    }, e.prototype.asNavFor = function (e) {
        var t = this.getNavTarget();
        null !== t && "object" == typeof t && t.each(function () {
            var t = i(this).slick("getSlick");
            t.unslicked || t.slideHandler(e, !0)
        })
    }, e.prototype.applyTransition = function (i) {
        var e = this, t = {};
        !1 === e.options.fade ? t[e.transitionType] = e.transformType + " " + e.options.speed + "ms " + e.options.cssEase : t[e.transitionType] = "opacity " + e.options.speed + "ms " + e.options.cssEase, !1 === e.options.fade ? e.$slideTrack.css(t) : e.$slides.eq(i).css(t)
    }, e.prototype.autoPlay = function () {
        var i = this;
        i.autoPlayClear(), i.slideCount > i.options.slidesToShow && (i.autoPlayTimer = setInterval(i.autoPlayIterator, i.options.autoplaySpeed))
    }, e.prototype.autoPlayClear = function () {
        this.autoPlayTimer && clearInterval(this.autoPlayTimer)
    }, e.prototype.autoPlayIterator = function () {
        var i = this, e = i.currentSlide + i.options.slidesToScroll;
        i.paused || i.interrupted || i.focussed || (!1 === i.options.infinite && (1 === i.direction && i.currentSlide + 1 === i.slideCount - 1 ? i.direction = 0 : 0 === i.direction && (e = i.currentSlide - i.options.slidesToScroll, i.currentSlide - 1 == 0 && (i.direction = 1))), i.slideHandler(e))
    }, e.prototype.buildArrows = function () {
        var e = this;
        !0 === e.options.arrows && (e.$prevArrow = i(e.options.prevArrow).addClass("slick-arrow"), e.$nextArrow = i(e.options.nextArrow).addClass("slick-arrow"), e.slideCount > e.options.slidesToShow ? (e.$prevArrow.removeClass("slick-hidden").removeAttr("aria-hidden tabindex"), e.$nextArrow.removeClass("slick-hidden").removeAttr("aria-hidden tabindex"), e.htmlExpr.test(e.options.prevArrow) && e.$prevArrow.prependTo(e.options.appendArrows), e.htmlExpr.test(e.options.nextArrow) && e.$nextArrow.appendTo(e.options.appendArrows), !0 !== e.options.infinite && e.$prevArrow.addClass("slick-disabled").attr("aria-disabled", "true")) : e.$prevArrow.add(e.$nextArrow).addClass("slick-hidden").attr({
            "aria-disabled": "true",
            tabindex: "-1"
        }))
    }, e.prototype.buildDots = function () {
        var e, t, o = this;
        if (!0 === o.options.dots && o.slideCount > o.options.slidesToShow) {
            for (o.$slider.addClass("slick-dotted"), t = i("<ul />").addClass(o.options.dotsClass), e = 0; e <= o.getDotCount(); e += 1) t.append(i("<li />").append(o.options.customPaging.call(this, o, e)));
            o.$dots = t.appendTo(o.options.appendDots), o.$dots.find("li").first().addClass("slick-active")
        }
    }, e.prototype.buildOut = function () {
        var e = this;
        e.$slides = e.$slider.children(e.options.slide + ":not(.slick-cloned)").addClass("slick-slide"), e.slideCount = e.$slides.length, e.$slides.each(function (e, t) {
            i(t).attr("data-slick-index", e).data("originalStyling", i(t).attr("style") || "")
        }), e.$slider.addClass("slick-slider"), e.$slideTrack = 0 === e.slideCount ? i('<div class="slick-track"/>').appendTo(e.$slider) : e.$slides.wrapAll('<div class="slick-track"/>').parent(), e.$list = e.$slideTrack.wrap('<div class="slick-list"/>').parent(), e.$slideTrack.css("opacity", 0), !0 !== e.options.centerMode && !0 !== e.options.swipeToSlide || (e.options.slidesToScroll = 1), i("img[data-lazy]", e.$slider).not("[src]").addClass("slick-loading"), e.setupInfinite(), e.buildArrows(), e.buildDots(), e.updateDots(), e.setSlideClasses("number" == typeof e.currentSlide ? e.currentSlide : 0), !0 === e.options.draggable && e.$list.addClass("draggable")
    }, e.prototype.buildRows = function () {
        var i, e, t, o, s, n, r, l = this;
        if (o = document.createDocumentFragment(), n = l.$slider.children(), l.options.rows > 0) {
            for (r = l.options.slidesPerRow * l.options.rows, s = Math.ceil(n.length / r), i = 0; i < s; i++) {
                var d = document.createElement("div");
                for (e = 0; e < l.options.rows; e++) {
                    var a = document.createElement("div");
                    for (t = 0; t < l.options.slidesPerRow; t++) {
                        var c = i * r + (e * l.options.slidesPerRow + t);
                        n.get(c) && a.appendChild(n.get(c))
                    }
                    d.appendChild(a)
                }
                o.appendChild(d)
            }
            l.$slider.empty().append(o), l.$slider.children().children().children().css({
                width: 100 / l.options.slidesPerRow + "%",
                display: "inline-block"
            })
        }
    }, e.prototype.checkResponsive = function (e, t) {
        var o, s, n, r = this, l = !1, d = r.$slider.width(), a = window.innerWidth || i(window).width();
        if ("window" === r.respondTo ? n = a : "slider" === r.respondTo ? n = d : "min" === r.respondTo && (n = Math.min(a, d)), r.options.responsive && r.options.responsive.length && null !== r.options.responsive) {
            s = null;
            for (o in r.breakpoints) r.breakpoints.hasOwnProperty(o) && (!1 === r.originalSettings.mobileFirst ? n < r.breakpoints[o] && (s = r.breakpoints[o]) : n > r.breakpoints[o] && (s = r.breakpoints[o]));
            null !== s ? null !== r.activeBreakpoint ? (s !== r.activeBreakpoint || t) && (r.activeBreakpoint = s, "unslick" === r.breakpointSettings[s] ? r.unslick(s) : (r.options = i.extend({}, r.originalSettings, r.breakpointSettings[s]), !0 === e && (r.currentSlide = r.options.initialSlide), r.refresh(e)), l = s) : (r.activeBreakpoint = s, "unslick" === r.breakpointSettings[s] ? r.unslick(s) : (r.options = i.extend({}, r.originalSettings, r.breakpointSettings[s]), !0 === e && (r.currentSlide = r.options.initialSlide), r.refresh(e)), l = s) : null !== r.activeBreakpoint && (r.activeBreakpoint = null, r.options = r.originalSettings, !0 === e && (r.currentSlide = r.options.initialSlide), r.refresh(e), l = s), e || !1 === l || r.$slider.trigger("breakpoint", [r, l])
        }
    }, e.prototype.changeSlide = function (e, t) {
        var o, s, n = this, r = i(e.currentTarget);
        switch (r.is("a") && e.preventDefault(), r.is("li") || (r = r.closest("li")), o = n.slideCount % n.options.slidesToScroll != 0 ? 0 : (n.slideCount - n.currentSlide) % n.options.slidesToScroll, e.data.message) {
            case"previous":
                s = 0 === o ? n.options.slidesToScroll : n.options.slidesToShow - o, n.slideCount > n.options.slidesToShow && n.slideHandler(n.currentSlide - s, !1, t);
                break;
            case"next":
                s = 0 === o ? n.options.slidesToScroll : o, n.slideCount > n.options.slidesToShow && n.slideHandler(n.currentSlide + s, !1, t);
                break;
            case"index":
                var l = 0 === e.data.index ? 0 : e.data.index || r.index() * n.options.slidesToScroll;
                n.slideHandler(n.checkNavigable(l), !1, t), r.children().trigger("focus");
                break;
            default:
                return
        }
    }, e.prototype.checkNavigable = function (i) {
        var e, t;
        if (t = 0, i > (e = this.getNavigableIndexes())[e.length - 1]) i = e[e.length - 1]; else for (var o in e) {
            if (i < e[o]) {
                i = t;
                break
            }
            t = e[o]
        }
        return i
    }, e.prototype.cleanUpEvents = function () {
        var e = this;
        e.options.dots && null !== e.$dots && (i("li", e.$dots).off("click.slick", e.changeSlide).off("mouseenter.slick", i.proxy(e.interrupt, e, !0)).off("mouseleave.slick", i.proxy(e.interrupt, e, !1)), !0 === e.options.accessibility && e.$dots.off("keydown.slick", e.keyHandler)), e.$slider.off("focus.slick blur.slick"), !0 === e.options.arrows && e.slideCount > e.options.slidesToShow && (e.$prevArrow && e.$prevArrow.off("click.slick", e.changeSlide), e.$nextArrow && e.$nextArrow.off("click.slick", e.changeSlide), !0 === e.options.accessibility && (e.$prevArrow && e.$prevArrow.off("keydown.slick", e.keyHandler), e.$nextArrow && e.$nextArrow.off("keydown.slick", e.keyHandler))), e.$list.off("touchstart.slick mousedown.slick", e.swipeHandler), e.$list.off("touchmove.slick mousemove.slick", e.swipeHandler), e.$list.off("touchend.slick mouseup.slick", e.swipeHandler), e.$list.off("touchcancel.slick mouseleave.slick", e.swipeHandler), e.$list.off("click.slick", e.clickHandler), i(document).off(e.visibilityChange, e.visibility), e.cleanUpSlideEvents(), !0 === e.options.accessibility && e.$list.off("keydown.slick", e.keyHandler), !0 === e.options.focusOnSelect && i(e.$slideTrack).children().off("click.slick", e.selectHandler), i(window).off("orientationchange.slick.slick-" + e.instanceUid, e.orientationChange), i(window).off("resize.slick.slick-" + e.instanceUid, e.resize), i("[draggable!=true]", e.$slideTrack).off("dragstart", e.preventDefault), i(window).off("load.slick.slick-" + e.instanceUid, e.setPosition)
    }, e.prototype.cleanUpSlideEvents = function () {
        var e = this;
        e.$list.off("mouseenter.slick", i.proxy(e.interrupt, e, !0)), e.$list.off("mouseleave.slick", i.proxy(e.interrupt, e, !1))
    }, e.prototype.cleanUpRows = function () {
        var i;
        this.options.rows > 0 && ((i = this.$slides.children().children()).removeAttr("style"), this.$slider.empty().append(i))
    }, e.prototype.clickHandler = function (i) {
        !1 === this.shouldClick && (i.stopImmediatePropagation(), i.stopPropagation(), i.preventDefault())
    }, e.prototype.destroy = function (e) {
        var t = this;
        t.autoPlayClear(), t.touchObject = {}, t.cleanUpEvents(), i(".slick-cloned", t.$slider).detach(), t.$dots && t.$dots.remove(), t.$prevArrow && t.$prevArrow.length && (t.$prevArrow.removeClass("slick-disabled slick-arrow slick-hidden").removeAttr("aria-hidden aria-disabled tabindex").css("display", ""), t.htmlExpr.test(t.options.prevArrow) && t.$prevArrow.remove()), t.$nextArrow && t.$nextArrow.length && (t.$nextArrow.removeClass("slick-disabled slick-arrow slick-hidden").removeAttr("aria-hidden aria-disabled tabindex").css("display", ""), t.htmlExpr.test(t.options.nextArrow) && t.$nextArrow.remove()), t.$slides && (t.$slides.removeClass("slick-slide slick-active slick-center slick-visible slick-current").removeAttr("aria-hidden").removeAttr("data-slick-index").each(function () {
            i(this).attr("style", i(this).data("originalStyling"))
        }), t.$slideTrack.children(this.options.slide).detach(), t.$slideTrack.detach(), t.$list.detach(), t.$slider.append(t.$slides)), t.cleanUpRows(), t.$slider.removeClass("slick-slider"), t.$slider.removeClass("slick-initialized"), t.$slider.removeClass("slick-dotted"), t.unslicked = !0, e || t.$slider.trigger("destroy", [t])
    }, e.prototype.disableTransition = function (i) {
        var e = {};
        e[this.transitionType] = "", !1 === this.options.fade ? this.$slideTrack.css(e) : this.$slides.eq(i).css(e)
    }, e.prototype.fadeSlide = function (i, e) {
        var t = this;
        !1 === t.cssTransitions ? (t.$slides.eq(i).css({zIndex: t.options.zIndex}), t.$slides.eq(i).animate({opacity: 1}, t.options.speed, t.options.easing, e)) : (t.applyTransition(i), t.$slides.eq(i).css({
            opacity: 1,
            zIndex: t.options.zIndex
        }), e && setTimeout(function () {
            t.disableTransition(i), e.call()
        }, t.options.speed))
    }, e.prototype.fadeSlideOut = function (i) {
        var e = this;
        !1 === e.cssTransitions ? e.$slides.eq(i).animate({
            opacity: 0,
            zIndex: e.options.zIndex - 2
        }, e.options.speed, e.options.easing) : (e.applyTransition(i), e.$slides.eq(i).css({
            opacity: 0,
            zIndex: e.options.zIndex - 2
        }))
    }, e.prototype.filterSlides = e.prototype.slickFilter = function (i) {
        var e = this;
        null !== i && (e.$slidesCache = e.$slides, e.unload(), e.$slideTrack.children(this.options.slide).detach(), e.$slidesCache.filter(i).appendTo(e.$slideTrack), e.reinit())
    }, e.prototype.focusHandler = function () {
        var e = this;
        e.$slider.off("focus.slick blur.slick").on("focus.slick blur.slick", "*", function (t) {
            t.stopImmediatePropagation();
            var o = i(this);
            setTimeout(function () {
                e.options.pauseOnFocus && (e.focussed = o.is(":focus"), e.autoPlay())
            }, 0)
        })
    }, e.prototype.getCurrent = e.prototype.slickCurrentSlide = function () {
        return this.currentSlide
    }, e.prototype.getDotCount = function () {
        var i = this, e = 0, t = 0, o = 0;
        if (!0 === i.options.infinite) if (i.slideCount <= i.options.slidesToShow) ++o; else for (; e < i.slideCount;) ++o, e = t + i.options.slidesToScroll, t += i.options.slidesToScroll <= i.options.slidesToShow ? i.options.slidesToScroll : i.options.slidesToShow; else if (!0 === i.options.centerMode) o = i.slideCount; else if (i.options.asNavFor) for (; e < i.slideCount;) ++o, e = t + i.options.slidesToScroll, t += i.options.slidesToScroll <= i.options.slidesToShow ? i.options.slidesToScroll : i.options.slidesToShow; else o = 1 + Math.ceil((i.slideCount - i.options.slidesToShow) / i.options.slidesToScroll);
        return o - 1
    }, e.prototype.getLeft = function (i) {
        var e, t, o, s, n = this, r = 0;
        return n.slideOffset = 0, t = n.$slides.first().outerHeight(!0), !0 === n.options.infinite ? (n.slideCount > n.options.slidesToShow && (n.slideOffset = n.slideWidth * n.options.slidesToShow * -1, s = -1, !0 === n.options.vertical && !0 === n.options.centerMode && (2 === n.options.slidesToShow ? s = -1.5 : 1 === n.options.slidesToShow && (s = -2)), r = t * n.options.slidesToShow * s), n.slideCount % n.options.slidesToScroll != 0 && i + n.options.slidesToScroll > n.slideCount && n.slideCount > n.options.slidesToShow && (i > n.slideCount ? (n.slideOffset = (n.options.slidesToShow - (i - n.slideCount)) * n.slideWidth * -1, r = (n.options.slidesToShow - (i - n.slideCount)) * t * -1) : (n.slideOffset = n.slideCount % n.options.slidesToScroll * n.slideWidth * -1, r = n.slideCount % n.options.slidesToScroll * t * -1))) : i + n.options.slidesToShow > n.slideCount && (n.slideOffset = (i + n.options.slidesToShow - n.slideCount) * n.slideWidth, r = (i + n.options.slidesToShow - n.slideCount) * t), n.slideCount <= n.options.slidesToShow && (n.slideOffset = 0, r = 0), !0 === n.options.centerMode && n.slideCount <= n.options.slidesToShow ? n.slideOffset = n.slideWidth * Math.floor(n.options.slidesToShow) / 2 - n.slideWidth * n.slideCount / 2 : !0 === n.options.centerMode && !0 === n.options.infinite ? n.slideOffset += n.slideWidth * Math.floor(n.options.slidesToShow / 2) - n.slideWidth : !0 === n.options.centerMode && (n.slideOffset = 0, n.slideOffset += n.slideWidth * Math.floor(n.options.slidesToShow / 2)), e = !1 === n.options.vertical ? i * n.slideWidth * -1 + n.slideOffset : i * t * -1 + r, !0 === n.options.variableWidth && (o = n.slideCount <= n.options.slidesToShow || !1 === n.options.infinite ? n.$slideTrack.children(".slick-slide").eq(i) : n.$slideTrack.children(".slick-slide").eq(i + n.options.slidesToShow), e = !0 === n.options.rtl ? o[0] ? -1 * (n.$slideTrack.width() - o[0].offsetLeft - o.width()) : 0 : o[0] ? -1 * o[0].offsetLeft : 0, !0 === n.options.centerMode && (o = n.slideCount <= n.options.slidesToShow || !1 === n.options.infinite ? n.$slideTrack.children(".slick-slide").eq(i) : n.$slideTrack.children(".slick-slide").eq(i + n.options.slidesToShow + 1), e = !0 === n.options.rtl ? o[0] ? -1 * (n.$slideTrack.width() - o[0].offsetLeft - o.width()) : 0 : o[0] ? -1 * o[0].offsetLeft : 0, e += (n.$list.width() - o.outerWidth()) / 2)), e
    }, e.prototype.getOption = e.prototype.slickGetOption = function (i) {
        return this.options[i]
    }, e.prototype.getNavigableIndexes = function () {
        var i, e = this, t = 0, o = 0, s = [];
        for (!1 === e.options.infinite ? i = e.slideCount : (t = -1 * e.options.slidesToScroll, o = -1 * e.options.slidesToScroll, i = 2 * e.slideCount); t < i;) s.push(t), t = o + e.options.slidesToScroll, o += e.options.slidesToScroll <= e.options.slidesToShow ? e.options.slidesToScroll : e.options.slidesToShow;
        return s
    }, e.prototype.getSlick = function () {
        return this
    }, e.prototype.getSlideCount = function () {
        var e, t, o = this;
        return t = !0 === o.options.centerMode ? o.slideWidth * Math.floor(o.options.slidesToShow / 2) : 0, !0 === o.options.swipeToSlide ? (o.$slideTrack.find(".slick-slide").each(function (s, n) {
            if (n.offsetLeft - t + i(n).outerWidth() / 2 > -1 * o.swipeLeft) return e = n, !1
        }), Math.abs(i(e).attr("data-slick-index") - o.currentSlide) || 1) : o.options.slidesToScroll
    }, e.prototype.goTo = e.prototype.slickGoTo = function (i, e) {
        this.changeSlide({data: {message: "index", index: parseInt(i)}}, e)
    }, e.prototype.init = function (e) {
        var t = this;
        i(t.$slider).hasClass("slick-initialized") || (i(t.$slider).addClass("slick-initialized"), t.buildRows(), t.buildOut(), t.setProps(), t.startLoad(), t.loadSlider(), t.initializeEvents(), t.updateArrows(), t.updateDots(), t.checkResponsive(!0), t.focusHandler()), e && t.$slider.trigger("init", [t]), !0 === t.options.accessibility && t.initADA(), t.options.autoplay && (t.paused = !1, t.autoPlay())
    }, e.prototype.initADA = function () {
        var e = this, t = Math.ceil(e.slideCount / e.options.slidesToShow),
            o = e.getNavigableIndexes().filter(function (i) {
                return i >= 0 && i < e.slideCount
            });
        e.$slides.add(e.$slideTrack.find(".slick-cloned")).attr({
            "aria-hidden": "true",
            tabindex: "-1"
        }).find("a, input, button, select").attr({tabindex: "-1"}), null !== e.$dots && (e.$slides.not(e.$slideTrack.find(".slick-cloned")).each(function (t) {
            var s = o.indexOf(t);
            if (i(this).attr({role: "tabpanel", id: "slick-slide" + e.instanceUid + t, tabindex: -1}), -1 !== s) {
                var n = "slick-slide-control" + e.instanceUid + s;
                i("#" + n).length && i(this).attr({"aria-describedby": n})
            }
        }), e.$dots.attr("role", "tablist").find("li").each(function (s) {
            var n = o[s];
            i(this).attr({role: "presentation"}), i(this).find("button").first().attr({
                role: "tab",
                id: "slick-slide-control" + e.instanceUid + s,
                "aria-controls": "slick-slide" + e.instanceUid + n,
                "aria-label": s + 1 + " of " + t,
                "aria-selected": null,
                tabindex: "-1"
            })
        }).eq(e.currentSlide).find("button").attr({"aria-selected": "true", tabindex: "0"}).end());
        for (var s = e.currentSlide, n = s + e.options.slidesToShow; s < n; s++) e.options.focusOnChange ? e.$slides.eq(s).attr({tabindex: "0"}) : e.$slides.eq(s).removeAttr("tabindex");
        e.activateADA()
    }, e.prototype.initArrowEvents = function () {
        var i = this;
        !0 === i.options.arrows && i.slideCount > i.options.slidesToShow && (i.$prevArrow.off("click.slick").on("click.slick", {message: "previous"}, i.changeSlide), i.$nextArrow.off("click.slick").on("click.slick", {message: "next"}, i.changeSlide), !0 === i.options.accessibility && (i.$prevArrow.on("keydown.slick", i.keyHandler), i.$nextArrow.on("keydown.slick", i.keyHandler)))
    }, e.prototype.initDotEvents = function () {
        var e = this;
        !0 === e.options.dots && e.slideCount > e.options.slidesToShow && (i("li", e.$dots).on("click.slick", {message: "index"}, e.changeSlide), !0 === e.options.accessibility && e.$dots.on("keydown.slick", e.keyHandler)), !0 === e.options.dots && !0 === e.options.pauseOnDotsHover && e.slideCount > e.options.slidesToShow && i("li", e.$dots).on("mouseenter.slick", i.proxy(e.interrupt, e, !0)).on("mouseleave.slick", i.proxy(e.interrupt, e, !1))
    }, e.prototype.initSlideEvents = function () {
        var e = this;
        e.options.pauseOnHover && (e.$list.on("mouseenter.slick", i.proxy(e.interrupt, e, !0)), e.$list.on("mouseleave.slick", i.proxy(e.interrupt, e, !1)))
    }, e.prototype.initializeEvents = function () {
        var e = this;
        e.initArrowEvents(), e.initDotEvents(), e.initSlideEvents(), e.$list.on("touchstart.slick mousedown.slick", {action: "start"}, e.swipeHandler), e.$list.on("touchmove.slick mousemove.slick", {action: "move"}, e.swipeHandler), e.$list.on("touchend.slick mouseup.slick", {action: "end"}, e.swipeHandler), e.$list.on("touchcancel.slick mouseleave.slick", {action: "end"}, e.swipeHandler), e.$list.on("click.slick", e.clickHandler), i(document).on(e.visibilityChange, i.proxy(e.visibility, e)), !0 === e.options.accessibility && e.$list.on("keydown.slick", e.keyHandler), !0 === e.options.focusOnSelect && i(e.$slideTrack).children().on("click.slick", e.selectHandler), i(window).on("orientationchange.slick.slick-" + e.instanceUid, i.proxy(e.orientationChange, e)), i(window).on("resize.slick.slick-" + e.instanceUid, i.proxy(e.resize, e)), i("[draggable!=true]", e.$slideTrack).on("dragstart", e.preventDefault), i(window).on("load.slick.slick-" + e.instanceUid, e.setPosition), i(e.setPosition)
    }, e.prototype.initUI = function () {
        var i = this;
        !0 === i.options.arrows && i.slideCount > i.options.slidesToShow && (i.$prevArrow.show(), i.$nextArrow.show()), !0 === i.options.dots && i.slideCount > i.options.slidesToShow && i.$dots.show()
    }, e.prototype.keyHandler = function (i) {
        var e = this;
        i.target.tagName.match("TEXTAREA|INPUT|SELECT") || (37 === i.keyCode && !0 === e.options.accessibility ? e.changeSlide({data: {message: !0 === e.options.rtl ? "next" : "previous"}}) : 39 === i.keyCode && !0 === e.options.accessibility && e.changeSlide({data: {message: !0 === e.options.rtl ? "previous" : "next"}}))
    }, e.prototype.lazyLoad = function () {
        var e, t, o, s = this;

        function n(e) {
            i("img[data-lazy]", e).each(function () {
                var e = i(this), t = i(this).attr("data-lazy"), o = i(this).attr("data-srcset"),
                    n = i(this).attr("data-sizes") || s.$slider.attr("data-sizes"), r = document.createElement("img");
                r.onload = function () {
                    e.animate({opacity: 0}, 100, function () {
                        o && (e.attr("srcset", o), n && e.attr("sizes", n)), e.attr("src", t).animate({opacity: 1}, 200, function () {
                            e.removeAttr("data-lazy data-srcset data-sizes").removeClass("slick-loading")
                        }), s.$slider.trigger("lazyLoaded", [s, e, t])
                    })
                }, r.onerror = function () {
                    e.removeAttr("data-lazy").removeClass("slick-loading").addClass("slick-lazyload-error"), s.$slider.trigger("lazyLoadError", [s, e, t])
                }, r.src = t
            })
        }

        if (!0 === s.options.centerMode ? !0 === s.options.infinite ? o = (t = s.currentSlide + (s.options.slidesToShow / 2 + 1)) + s.options.slidesToShow + 2 : (t = Math.max(0, s.currentSlide - (s.options.slidesToShow / 2 + 1)), o = s.options.slidesToShow / 2 + 1 + 2 + s.currentSlide) : (t = s.options.infinite ? s.options.slidesToShow + s.currentSlide : s.currentSlide, o = Math.ceil(t + s.options.slidesToShow), !0 === s.options.fade && (t > 0 && t--, o <= s.slideCount && o++)), e = s.$slider.find(".slick-slide").slice(t, o), "anticipated" === s.options.lazyLoad) for (var r = t - 1, l = o, d = s.$slider.find(".slick-slide"), a = 0; a < s.options.slidesToScroll; a++) r < 0 && (r = s.slideCount - 1), e = (e = e.add(d.eq(r))).add(d.eq(l)), r--, l++;
        n(e), s.slideCount <= s.options.slidesToShow ? n(s.$slider.find(".slick-slide")) : s.currentSlide >= s.slideCount - s.options.slidesToShow ? n(s.$slider.find(".slick-cloned").slice(0, s.options.slidesToShow)) : 0 === s.currentSlide && n(s.$slider.find(".slick-cloned").slice(-1 * s.options.slidesToShow))
    }, e.prototype.loadSlider = function () {
        var i = this;
        i.setPosition(), i.$slideTrack.css({opacity: 1}), i.$slider.removeClass("slick-loading"), i.initUI(), "progressive" === i.options.lazyLoad && i.progressiveLazyLoad()
    }, e.prototype.next = e.prototype.slickNext = function () {
        this.changeSlide({data: {message: "next"}})
    }, e.prototype.orientationChange = function () {
        this.checkResponsive(), this.setPosition()
    }, e.prototype.pause = e.prototype.slickPause = function () {
        this.autoPlayClear(), this.paused = !0
    }, e.prototype.play = e.prototype.slickPlay = function () {
        var i = this;
        i.autoPlay(), i.options.autoplay = !0, i.paused = !1, i.focussed = !1, i.interrupted = !1
    }, e.prototype.postSlide = function (e) {
        var t = this;
        t.unslicked || (t.$slider.trigger("afterChange", [t, e]), t.animating = !1, t.slideCount > t.options.slidesToShow && t.setPosition(), t.swipeLeft = null, t.options.autoplay && t.autoPlay(), !0 === t.options.accessibility && (t.initADA(), t.options.focusOnChange && i(t.$slides.get(t.currentSlide)).attr("tabindex", 0).focus()))
    }, e.prototype.prev = e.prototype.slickPrev = function () {
        this.changeSlide({data: {message: "previous"}})
    }, e.prototype.preventDefault = function (i) {
        i.preventDefault()
    }, e.prototype.progressiveLazyLoad = function (e) {
        e = e || 1;
        var t, o, s, n, r, l = this, d = i("img[data-lazy]", l.$slider);
        d.length ? (t = d.first(), o = t.attr("data-lazy"), s = t.attr("data-srcset"), n = t.attr("data-sizes") || l.$slider.attr("data-sizes"), (r = document.createElement("img")).onload = function () {
            s && (t.attr("srcset", s), n && t.attr("sizes", n)), t.attr("src", o).removeAttr("data-lazy data-srcset data-sizes").removeClass("slick-loading"), !0 === l.options.adaptiveHeight && l.setPosition(), l.$slider.trigger("lazyLoaded", [l, t, o]), l.progressiveLazyLoad()
        }, r.onerror = function () {
            e < 3 ? setTimeout(function () {
                l.progressiveLazyLoad(e + 1)
            }, 500) : (t.removeAttr("data-lazy").removeClass("slick-loading").addClass("slick-lazyload-error"), l.$slider.trigger("lazyLoadError", [l, t, o]), l.progressiveLazyLoad())
        }, r.src = o) : l.$slider.trigger("allImagesLoaded", [l])
    }, e.prototype.refresh = function (e) {
        var t, o, s = this;
        o = s.slideCount - s.options.slidesToShow, !s.options.infinite && s.currentSlide > o && (s.currentSlide = o), s.slideCount <= s.options.slidesToShow && (s.currentSlide = 0), t = s.currentSlide, s.destroy(!0), i.extend(s, s.initials, {currentSlide: t}), s.init(), e || s.changeSlide({
            data: {
                message: "index",
                index: t
            }
        }, !1)
    }, e.prototype.registerBreakpoints = function () {
        var e, t, o, s = this, n = s.options.responsive || null;
        if ("array" === i.type(n) && n.length) {
            s.respondTo = s.options.respondTo || "window";
            for (e in n) if (o = s.breakpoints.length - 1, n.hasOwnProperty(e)) {
                for (t = n[e].breakpoint; o >= 0;) s.breakpoints[o] && s.breakpoints[o] === t && s.breakpoints.splice(o, 1), o--;
                s.breakpoints.push(t), s.breakpointSettings[t] = n[e].settings
            }
            s.breakpoints.sort(function (i, e) {
                return s.options.mobileFirst ? i - e : e - i
            })
        }
    }, e.prototype.reinit = function () {
        var e = this;
        e.$slides = e.$slideTrack.children(e.options.slide).addClass("slick-slide"), e.slideCount = e.$slides.length, e.currentSlide >= e.slideCount && 0 !== e.currentSlide && (e.currentSlide = e.currentSlide - e.options.slidesToScroll), e.slideCount <= e.options.slidesToShow && (e.currentSlide = 0), e.registerBreakpoints(), e.setProps(), e.setupInfinite(), e.buildArrows(), e.updateArrows(), e.initArrowEvents(), e.buildDots(), e.updateDots(), e.initDotEvents(), e.cleanUpSlideEvents(), e.initSlideEvents(), e.checkResponsive(!1, !0), !0 === e.options.focusOnSelect && i(e.$slideTrack).children().on("click.slick", e.selectHandler), e.setSlideClasses("number" == typeof e.currentSlide ? e.currentSlide : 0), e.setPosition(), e.focusHandler(), e.paused = !e.options.autoplay, e.autoPlay(), e.$slider.trigger("reInit", [e])
    }, e.prototype.resize = function () {
        var e = this;
        i(window).width() !== e.windowWidth && (clearTimeout(e.windowDelay), e.windowDelay = window.setTimeout(function () {
            e.windowWidth = i(window).width(), e.checkResponsive(), e.unslicked || e.setPosition()
        }, 50))
    }, e.prototype.removeSlide = e.prototype.slickRemove = function (i, e, t) {
        var o = this;
        if (i = "boolean" == typeof i ? !0 === (e = i) ? 0 : o.slideCount - 1 : !0 === e ? --i : i, o.slideCount < 1 || i < 0 || i > o.slideCount - 1) return !1;
        o.unload(), !0 === t ? o.$slideTrack.children().remove() : o.$slideTrack.children(this.options.slide).eq(i).remove(), o.$slides = o.$slideTrack.children(this.options.slide), o.$slideTrack.children(this.options.slide).detach(), o.$slideTrack.append(o.$slides), o.$slidesCache = o.$slides, o.reinit()
    }, e.prototype.setCSS = function (i) {
        var e, t, o = this, s = {};
        !0 === o.options.rtl && (i = -i), e = "left" == o.positionProp ? Math.ceil(i) + "px" : "0px", t = "top" == o.positionProp ? Math.ceil(i) + "px" : "0px", s[o.positionProp] = i, !1 === o.transformsEnabled ? o.$slideTrack.css(s) : (s = {}, !1 === o.cssTransitions ? (s[o.animType] = "translate(" + e + ", " + t + ")", o.$slideTrack.css(s)) : (s[o.animType] = "translate3d(" + e + ", " + t + ", 0px)", o.$slideTrack.css(s)))
    }, e.prototype.setDimensions = function () {
        var i = this;
        !1 === i.options.vertical ? !0 === i.options.centerMode && i.$list.css({padding: "0px " + i.options.centerPadding}) : (i.$list.height(i.$slides.first().outerHeight(!0) * i.options.slidesToShow), !0 === i.options.centerMode && i.$list.css({padding: i.options.centerPadding + " 0px"})), i.listWidth = i.$list.width(), i.listHeight = i.$list.height(), !1 === i.options.vertical && !1 === i.options.variableWidth ? (i.slideWidth = Math.ceil(i.listWidth / i.options.slidesToShow), i.$slideTrack.width(Math.ceil(i.slideWidth * i.$slideTrack.children(".slick-slide").length))) : !0 === i.options.variableWidth ? i.$slideTrack.width(5e3 * i.slideCount) : (i.slideWidth = Math.ceil(i.listWidth), i.$slideTrack.height(Math.ceil(i.$slides.first().outerHeight(!0) * i.$slideTrack.children(".slick-slide").length)));
        var e = i.$slides.first().outerWidth(!0) - i.$slides.first().width();
        !1 === i.options.variableWidth && i.$slideTrack.children(".slick-slide").width(i.slideWidth - e)
    }, e.prototype.setFade = function () {
        var e, t = this;
        t.$slides.each(function (o, s) {
            e = t.slideWidth * o * -1, !0 === t.options.rtl ? i(s).css({
                position: "relative",
                right: e,
                top: 0,
                zIndex: t.options.zIndex - 2,
                opacity: 0
            }) : i(s).css({position: "relative", left: e, top: 0, zIndex: t.options.zIndex - 2, opacity: 0})
        }), t.$slides.eq(t.currentSlide).css({zIndex: t.options.zIndex - 1, opacity: 1})
    }, e.prototype.setHeight = function () {
        var i = this;
        if (1 === i.options.slidesToShow && !0 === i.options.adaptiveHeight && !1 === i.options.vertical) {
            var e = i.$slides.eq(i.currentSlide).outerHeight(!0);
            i.$list.css("height", e)
        }
    }, e.prototype.setOption = e.prototype.slickSetOption = function () {
        var e, t, o, s, n, r = this, l = !1;
        if ("object" === i.type(arguments[0]) ? (o = arguments[0], l = arguments[1], n = "multiple") : "string" === i.type(arguments[0]) && (o = arguments[0], s = arguments[1], l = arguments[2], "responsive" === arguments[0] && "array" === i.type(arguments[1]) ? n = "responsive" : void 0 !== arguments[1] && (n = "single")), "single" === n) r.options[o] = s; else if ("multiple" === n) i.each(o, function (i, e) {
            r.options[i] = e
        }); else if ("responsive" === n) for (t in s) if ("array" !== i.type(r.options.responsive)) r.options.responsive = [s[t]]; else {
            for (e = r.options.responsive.length - 1; e >= 0;) r.options.responsive[e].breakpoint === s[t].breakpoint && r.options.responsive.splice(e, 1), e--;
            r.options.responsive.push(s[t])
        }
        l && (r.unload(), r.reinit())
    }, e.prototype.setPosition = function () {
        var i = this;
        i.setDimensions(), i.setHeight(), !1 === i.options.fade ? i.setCSS(i.getLeft(i.currentSlide)) : i.setFade(), i.$slider.trigger("setPosition", [i])
    }, e.prototype.setProps = function () {
        var i = this, e = document.body.style;
        i.positionProp = !0 === i.options.vertical ? "top" : "left", "top" === i.positionProp ? i.$slider.addClass("slick-vertical") : i.$slider.removeClass("slick-vertical"), void 0 === e.WebkitTransition && void 0 === e.MozTransition && void 0 === e.msTransition || !0 === i.options.useCSS && (i.cssTransitions = !0), i.options.fade && ("number" == typeof i.options.zIndex ? i.options.zIndex < 3 && (i.options.zIndex = 3) : i.options.zIndex = i.defaults.zIndex), void 0 !== e.OTransform && (i.animType = "OTransform", i.transformType = "-o-transform", i.transitionType = "OTransition", void 0 === e.perspectiveProperty && void 0 === e.webkitPerspective && (i.animType = !1)), void 0 !== e.MozTransform && (i.animType = "MozTransform", i.transformType = "-moz-transform", i.transitionType = "MozTransition", void 0 === e.perspectiveProperty && void 0 === e.MozPerspective && (i.animType = !1)), void 0 !== e.webkitTransform && (i.animType = "webkitTransform", i.transformType = "-webkit-transform", i.transitionType = "webkitTransition", void 0 === e.perspectiveProperty && void 0 === e.webkitPerspective && (i.animType = !1)), void 0 !== e.msTransform && (i.animType = "msTransform", i.transformType = "-ms-transform", i.transitionType = "msTransition", void 0 === e.msTransform && (i.animType = !1)), void 0 !== e.transform && !1 !== i.animType && (i.animType = "transform", i.transformType = "transform", i.transitionType = "transition"), i.transformsEnabled = i.options.useTransform && null !== i.animType && !1 !== i.animType
    }, e.prototype.setSlideClasses = function (i) {
        var e, t, o, s, n = this;
        if (t = n.$slider.find(".slick-slide").removeClass("slick-active slick-center slick-current").attr("aria-hidden", "true"), n.$slides.eq(i).addClass("slick-current"), !0 === n.options.centerMode) {
            var r = n.options.slidesToShow % 2 == 0 ? 1 : 0;
            e = Math.floor(n.options.slidesToShow / 2), !0 === n.options.infinite && (i >= e && i <= n.slideCount - 1 - e ? n.$slides.slice(i - e + r, i + e + 1).addClass("slick-active").attr("aria-hidden", "false") : (o = n.options.slidesToShow + i, t.slice(o - e + 1 + r, o + e + 2).addClass("slick-active").attr("aria-hidden", "false")), 0 === i ? t.eq(t.length - 1 - n.options.slidesToShow).addClass("slick-center") : i === n.slideCount - 1 && t.eq(n.options.slidesToShow).addClass("slick-center")), n.$slides.eq(i).addClass("slick-center")
        } else i >= 0 && i <= n.slideCount - n.options.slidesToShow ? n.$slides.slice(i, i + n.options.slidesToShow).addClass("slick-active").attr("aria-hidden", "false") : t.length <= n.options.slidesToShow ? t.addClass("slick-active").attr("aria-hidden", "false") : (s = n.slideCount % n.options.slidesToShow, o = !0 === n.options.infinite ? n.options.slidesToShow + i : i, n.options.slidesToShow == n.options.slidesToScroll && n.slideCount - i < n.options.slidesToShow ? t.slice(o - (n.options.slidesToShow - s), o + s).addClass("slick-active").attr("aria-hidden", "false") : t.slice(o, o + n.options.slidesToShow).addClass("slick-active").attr("aria-hidden", "false"));
        "ondemand" !== n.options.lazyLoad && "anticipated" !== n.options.lazyLoad || n.lazyLoad()
    }, e.prototype.setupInfinite = function () {
        var e, t, o, s = this;
        if (!0 === s.options.fade && (s.options.centerMode = !1), !0 === s.options.infinite && !1 === s.options.fade && (t = null, s.slideCount > s.options.slidesToShow)) {
            for (o = !0 === s.options.centerMode ? s.options.slidesToShow + 1 : s.options.slidesToShow, e = s.slideCount; e > s.slideCount - o; e -= 1) t = e - 1, i(s.$slides[t]).clone(!0).attr("id", "").attr("data-slick-index", t - s.slideCount).prependTo(s.$slideTrack).addClass("slick-cloned");
            for (e = 0; e < o + s.slideCount; e += 1) t = e, i(s.$slides[t]).clone(!0).attr("id", "").attr("data-slick-index", t + s.slideCount).appendTo(s.$slideTrack).addClass("slick-cloned");
            s.$slideTrack.find(".slick-cloned").find("[id]").each(function () {
                i(this).attr("id", "")
            })
        }
    }, e.prototype.interrupt = function (i) {
        i || this.autoPlay(), this.interrupted = i
    }, e.prototype.selectHandler = function (e) {
        var t = i(e.target).is(".slick-slide") ? i(e.target) : i(e.target).parents(".slick-slide"),
            o = parseInt(t.attr("data-slick-index"));
        o || (o = 0), this.slideCount <= this.options.slidesToShow ? this.slideHandler(o, !1, !0) : this.slideHandler(o)
    }, e.prototype.slideHandler = function (i, e, t) {
        var o, s, n, r, l, d, a = this;
        if (e = e || !1, !(!0 === a.animating && !0 === a.options.waitForAnimate || !0 === a.options.fade && a.currentSlide === i)) if (!1 === e && a.asNavFor(i), o = i, l = a.getLeft(o), r = a.getLeft(a.currentSlide), a.currentLeft = null === a.swipeLeft ? r : a.swipeLeft, !1 === a.options.infinite && !1 === a.options.centerMode && (i < 0 || i > a.getDotCount() * a.options.slidesToScroll)) !1 === a.options.fade && (o = a.currentSlide, !0 !== t && a.slideCount > a.options.slidesToShow ? a.animateSlide(r, function () {
            a.postSlide(o)
        }) : a.postSlide(o)); else if (!1 === a.options.infinite && !0 === a.options.centerMode && (i < 0 || i > a.slideCount - a.options.slidesToScroll)) !1 === a.options.fade && (o = a.currentSlide, !0 !== t && a.slideCount > a.options.slidesToShow ? a.animateSlide(r, function () {
            a.postSlide(o)
        }) : a.postSlide(o)); else {
            if (a.options.autoplay && clearInterval(a.autoPlayTimer), s = o < 0 ? a.slideCount % a.options.slidesToScroll != 0 ? a.slideCount - a.slideCount % a.options.slidesToScroll : a.slideCount + o : o >= a.slideCount ? a.slideCount % a.options.slidesToScroll != 0 ? 0 : o - a.slideCount : o, a.animating = !0, a.$slider.trigger("beforeChange", [a, a.currentSlide, s]), n = a.currentSlide, a.currentSlide = s, a.setSlideClasses(a.currentSlide), a.options.asNavFor && (d = (d = a.getNavTarget()).slick("getSlick")).slideCount <= d.options.slidesToShow && d.setSlideClasses(a.currentSlide), a.updateDots(), a.updateArrows(), !0 === a.options.fade) return !0 !== t ? (a.fadeSlideOut(n), a.fadeSlide(s, function () {
                a.postSlide(s)
            })) : a.postSlide(s), void a.animateHeight();
            !0 !== t && a.slideCount > a.options.slidesToShow ? a.animateSlide(l, function () {
                a.postSlide(s)
            }) : a.postSlide(s)
        }
    }, e.prototype.startLoad = function () {
        var i = this;
        !0 === i.options.arrows && i.slideCount > i.options.slidesToShow && (i.$prevArrow.hide(), i.$nextArrow.hide()), !0 === i.options.dots && i.slideCount > i.options.slidesToShow && i.$dots.hide(), i.$slider.addClass("slick-loading")
    }, e.prototype.swipeDirection = function () {
        var i, e, t, o, s = this;
        return i = s.touchObject.startX - s.touchObject.curX, e = s.touchObject.startY - s.touchObject.curY, t = Math.atan2(e, i), (o = Math.round(180 * t / Math.PI)) < 0 && (o = 360 - Math.abs(o)), o <= 45 && o >= 0 ? !1 === s.options.rtl ? "left" : "right" : o <= 360 && o >= 315 ? !1 === s.options.rtl ? "left" : "right" : o >= 135 && o <= 225 ? !1 === s.options.rtl ? "right" : "left" : !0 === s.options.verticalSwiping ? o >= 35 && o <= 135 ? "down" : "up" : "vertical"
    }, e.prototype.swipeEnd = function (i) {
        var e, t, o = this;
        if (o.dragging = !1, o.swiping = !1, o.scrolling) return o.scrolling = !1, !1;
        if (o.interrupted = !1, o.shouldClick = !(o.touchObject.swipeLength > 10), void 0 === o.touchObject.curX) return !1;
        if (!0 === o.touchObject.edgeHit && o.$slider.trigger("edge", [o, o.swipeDirection()]), o.touchObject.swipeLength >= o.touchObject.minSwipe) {
            switch (t = o.swipeDirection()) {
                case"left":
                case"down":
                    e = o.options.swipeToSlide ? o.checkNavigable(o.currentSlide + o.getSlideCount()) : o.currentSlide + o.getSlideCount(), o.currentDirection = 0;
                    break;
                case"right":
                case"up":
                    e = o.options.swipeToSlide ? o.checkNavigable(o.currentSlide - o.getSlideCount()) : o.currentSlide - o.getSlideCount(), o.currentDirection = 1
            }
            "vertical" != t && (o.slideHandler(e), o.touchObject = {}, o.$slider.trigger("swipe", [o, t]))
        } else o.touchObject.startX !== o.touchObject.curX && (o.slideHandler(o.currentSlide), o.touchObject = {})
    }, e.prototype.swipeHandler = function (i) {
        var e = this;
        if (!(!1 === e.options.swipe || "ontouchend" in document && !1 === e.options.swipe || !1 === e.options.draggable && -1 !== i.type.indexOf("mouse"))) switch (e.touchObject.fingerCount = i.originalEvent && void 0 !== i.originalEvent.touches ? i.originalEvent.touches.length : 1, e.touchObject.minSwipe = e.listWidth / e.options.touchThreshold, !0 === e.options.verticalSwiping && (e.touchObject.minSwipe = e.listHeight / e.options.touchThreshold), i.data.action) {
            case"start":
                e.swipeStart(i);
                break;
            case"move":
                e.swipeMove(i);
                break;
            case"end":
                e.swipeEnd(i)
        }
    }, e.prototype.swipeMove = function (i) {
        var e, t, o, s, n, r, l = this;
        return n = void 0 !== i.originalEvent ? i.originalEvent.touches : null, !(!l.dragging || l.scrolling || n && 1 !== n.length) && (e = l.getLeft(l.currentSlide), l.touchObject.curX = void 0 !== n ? n[0].pageX : i.clientX, l.touchObject.curY = void 0 !== n ? n[0].pageY : i.clientY, l.touchObject.swipeLength = Math.round(Math.sqrt(Math.pow(l.touchObject.curX - l.touchObject.startX, 2))), r = Math.round(Math.sqrt(Math.pow(l.touchObject.curY - l.touchObject.startY, 2))), !l.options.verticalSwiping && !l.swiping && r > 4 ? (l.scrolling = !0, !1) : (!0 === l.options.verticalSwiping && (l.touchObject.swipeLength = r), t = l.swipeDirection(), void 0 !== i.originalEvent && l.touchObject.swipeLength > 4 && (l.swiping = !0, i.preventDefault()), s = (!1 === l.options.rtl ? 1 : -1) * (l.touchObject.curX > l.touchObject.startX ? 1 : -1), !0 === l.options.verticalSwiping && (s = l.touchObject.curY > l.touchObject.startY ? 1 : -1), o = l.touchObject.swipeLength, l.touchObject.edgeHit = !1, !1 === l.options.infinite && (0 === l.currentSlide && "right" === t || l.currentSlide >= l.getDotCount() && "left" === t) && (o = l.touchObject.swipeLength * l.options.edgeFriction, l.touchObject.edgeHit = !0), !1 === l.options.vertical ? l.swipeLeft = e + o * s : l.swipeLeft = e + o * (l.$list.height() / l.listWidth) * s, !0 === l.options.verticalSwiping && (l.swipeLeft = e + o * s), !0 !== l.options.fade && !1 !== l.options.touchMove && (!0 === l.animating ? (l.swipeLeft = null, !1) : void l.setCSS(l.swipeLeft))))
    }, e.prototype.swipeStart = function (i) {
        var e, t = this;
        if (t.interrupted = !0, 1 !== t.touchObject.fingerCount || t.slideCount <= t.options.slidesToShow) return t.touchObject = {}, !1;
        void 0 !== i.originalEvent && void 0 !== i.originalEvent.touches && (e = i.originalEvent.touches[0]), t.touchObject.startX = t.touchObject.curX = void 0 !== e ? e.pageX : i.clientX, t.touchObject.startY = t.touchObject.curY = void 0 !== e ? e.pageY : i.clientY, t.dragging = !0
    }, e.prototype.unfilterSlides = e.prototype.slickUnfilter = function () {
        var i = this;
        null !== i.$slidesCache && (i.unload(), i.$slideTrack.children(this.options.slide).detach(), i.$slidesCache.appendTo(i.$slideTrack), i.reinit())
    }, e.prototype.unload = function () {
        var e = this;
        i(".slick-cloned", e.$slider).remove(), e.$dots && e.$dots.remove(), e.$prevArrow && e.htmlExpr.test(e.options.prevArrow) && e.$prevArrow.remove(), e.$nextArrow && e.htmlExpr.test(e.options.nextArrow) && e.$nextArrow.remove(), e.$slides.removeClass("slick-slide slick-active slick-visible slick-current").attr("aria-hidden", "true").css("width", "")
    }, e.prototype.unslick = function (i) {
        this.$slider.trigger("unslick", [this, i]), this.destroy()
    }, e.prototype.updateArrows = function () {
        var i = this;
        Math.floor(i.options.slidesToShow / 2), !0 === i.options.arrows && i.slideCount > i.options.slidesToShow && !i.options.infinite && (i.$prevArrow.removeClass("slick-disabled").attr("aria-disabled", "false"), i.$nextArrow.removeClass("slick-disabled").attr("aria-disabled", "false"), 0 === i.currentSlide ? (i.$prevArrow.addClass("slick-disabled").attr("aria-disabled", "true"), i.$nextArrow.removeClass("slick-disabled").attr("aria-disabled", "false")) : i.currentSlide >= i.slideCount - i.options.slidesToShow && !1 === i.options.centerMode ? (i.$nextArrow.addClass("slick-disabled").attr("aria-disabled", "true"), i.$prevArrow.removeClass("slick-disabled").attr("aria-disabled", "false")) : i.currentSlide >= i.slideCount - 1 && !0 === i.options.centerMode && (i.$nextArrow.addClass("slick-disabled").attr("aria-disabled", "true"), i.$prevArrow.removeClass("slick-disabled").attr("aria-disabled", "false")))
    }, e.prototype.updateDots = function () {
        var i = this;
        null !== i.$dots && (i.$dots.find("li").removeClass("slick-active").end(), i.$dots.find("li").eq(Math.floor(i.currentSlide / i.options.slidesToScroll)).addClass("slick-active"))
    }, e.prototype.visibility = function () {
        this.options.autoplay && (document[this.hidden] ? this.interrupted = !0 : this.interrupted = !1)
    }, i.fn.slick = function () {
        var i, t, o = this, s = arguments[0], n = Array.prototype.slice.call(arguments, 1), r = o.length;
        for (i = 0; i < r; i++) if ("object" == typeof s || void 0 === s ? o[i].slick = new e(o[i], s) : t = o[i].slick[s].apply(o[i].slick, n), void 0 !== t) return t;
        return o
    }
});

//Tween Max v1.18.0
var _gsScope = "undefined" != typeof module && module.exports && "undefined" != typeof global ? global : this || window;
(_gsScope._gsQueue || (_gsScope._gsQueue = [])).push(function () {
    "use strict";
    _gsScope._gsDefine("TweenMax", ["core.Animation", "core.SimpleTimeline", "TweenLite"], function (t, e, i) {
        var s = function (t) {
            var e, i = [], s = t.length;
            for (e = 0; e !== s; i.push(t[e++])) ;
            return i
        }, r = function (t, e, i) {
            var s, r, n = t.cycle;
            for (s in n) r = n[s], t[s] = "function" == typeof r ? r.call(e[i], i) : r[i % r.length];
            delete t.cycle
        }, n = function (t, e, s) {
            i.call(this, t, e, s), this._cycle = 0, this._yoyo = this.vars.yoyo === !0, this._repeat = this.vars.repeat || 0, this._repeatDelay = this.vars.repeatDelay || 0, this._dirty = !0, this.render = n.prototype.render
        }, a = 1e-10, o = i._internals, l = o.isSelector, h = o.isArray, _ = n.prototype = i.to({}, .1, {}), u = [];
        n.version = "1.18.0", _.constructor = n, _.kill()._gc = !1, n.killTweensOf = n.killDelayedCallsTo = i.killTweensOf, n.getTweensOf = i.getTweensOf, n.lagSmoothing = i.lagSmoothing, n.ticker = i.ticker, n.render = i.render, _.invalidate = function () {
            return this._yoyo = this.vars.yoyo === !0, this._repeat = this.vars.repeat || 0, this._repeatDelay = this.vars.repeatDelay || 0, this._uncache(!0), i.prototype.invalidate.call(this)
        }, _.updateTo = function (t, e) {
            var s, r = this.ratio, n = this.vars.immediateRender || t.immediateRender;
            e && this._startTime < this._timeline._time && (this._startTime = this._timeline._time, this._uncache(!1), this._gc ? this._enabled(!0, !1) : this._timeline.insert(this, this._startTime - this._delay));
            for (s in t) this.vars[s] = t[s];
            if (this._initted || n) if (e) this._initted = !1, n && this.render(0, !0, !0); else if (this._gc && this._enabled(!0, !1), this._notifyPluginsOfEnabled && this._firstPT && i._onPluginEvent("_onDisable", this), this._time / this._duration > .998) {
                var a = this._time;
                this.render(0, !0, !1), this._initted = !1, this.render(a, !0, !1)
            } else if (this._time > 0 || n) {
                this._initted = !1, this._init();
                for (var o, l = 1 / (1 - r), h = this._firstPT; h;) o = h.s + h.c, h.c *= l, h.s = o - h.c, h = h._next
            }
            return this
        }, _.render = function (t, e, i) {
            this._initted || 0 === this._duration && this.vars.repeat && this.invalidate();
            var s, r, n, l, h, _, u, c, f = this._dirty ? this.totalDuration() : this._totalDuration, p = this._time,
                m = this._totalTime, d = this._cycle, g = this._duration, v = this._rawPrevTime;
            if (t >= f ? (this._totalTime = f, this._cycle = this._repeat, this._yoyo && 0 !== (1 & this._cycle) ? (this._time = 0, this.ratio = this._ease._calcEnd ? this._ease.getRatio(0) : 0) : (this._time = g, this.ratio = this._ease._calcEnd ? this._ease.getRatio(1) : 1), this._reversed || (s = !0, r = "onComplete", i = i || this._timeline.autoRemoveChildren), 0 === g && (this._initted || !this.vars.lazy || i) && (this._startTime === this._timeline._duration && (t = 0), (0 === t || 0 > v || v === a) && v !== t && (i = !0, v > a && (r = "onReverseComplete")), this._rawPrevTime = c = !e || t || v === t ? t : a)) : 1e-7 > t ? (this._totalTime = this._time = this._cycle = 0, this.ratio = this._ease._calcEnd ? this._ease.getRatio(0) : 0, (0 !== m || 0 === g && v > 0) && (r = "onReverseComplete", s = this._reversed), 0 > t && (this._active = !1, 0 === g && (this._initted || !this.vars.lazy || i) && (v >= 0 && (i = !0), this._rawPrevTime = c = !e || t || v === t ? t : a)), this._initted || (i = !0)) : (this._totalTime = this._time = t, 0 !== this._repeat && (l = g + this._repeatDelay, this._cycle = this._totalTime / l >> 0, 0 !== this._cycle && this._cycle === this._totalTime / l && this._cycle--, this._time = this._totalTime - this._cycle * l, this._yoyo && 0 !== (1 & this._cycle) && (this._time = g - this._time), this._time > g ? this._time = g : 0 > this._time && (this._time = 0)), this._easeType ? (h = this._time / g, _ = this._easeType, u = this._easePower, (1 === _ || 3 === _ && h >= .5) && (h = 1 - h), 3 === _ && (h *= 2), 1 === u ? h *= h : 2 === u ? h *= h * h : 3 === u ? h *= h * h * h : 4 === u && (h *= h * h * h * h), this.ratio = 1 === _ ? 1 - h : 2 === _ ? h : .5 > this._time / g ? h / 2 : 1 - h / 2) : this.ratio = this._ease.getRatio(this._time / g)), p === this._time && !i && d === this._cycle) return m !== this._totalTime && this._onUpdate && (e || this._callback("onUpdate")), void 0;
            if (!this._initted) {
                if (this._init(), !this._initted || this._gc) return;
                if (!i && this._firstPT && (this.vars.lazy !== !1 && this._duration || this.vars.lazy && !this._duration)) return this._time = p, this._totalTime = m, this._rawPrevTime = v, this._cycle = d, o.lazyTweens.push(this), this._lazy = [t, e], void 0;
                this._time && !s ? this.ratio = this._ease.getRatio(this._time / g) : s && this._ease._calcEnd && (this.ratio = this._ease.getRatio(0 === this._time ? 0 : 1))
            }
            for (this._lazy !== !1 && (this._lazy = !1), this._active || !this._paused && this._time !== p && t >= 0 && (this._active = !0), 0 === m && (2 === this._initted && t > 0 && this._init(), this._startAt && (t >= 0 ? this._startAt.render(t, e, i) : r || (r = "_dummyGS")), this.vars.onStart && (0 !== this._totalTime || 0 === g) && (e || this._callback("onStart"))), n = this._firstPT; n;) n.f ? n.t[n.p](n.c * this.ratio + n.s) : n.t[n.p] = n.c * this.ratio + n.s, n = n._next;
            this._onUpdate && (0 > t && this._startAt && this._startTime && this._startAt.render(t, e, i), e || (this._totalTime !== m || s) && this._callback("onUpdate")), this._cycle !== d && (e || this._gc || this.vars.onRepeat && this._callback("onRepeat")), r && (!this._gc || i) && (0 > t && this._startAt && !this._onUpdate && this._startTime && this._startAt.render(t, e, i), s && (this._timeline.autoRemoveChildren && this._enabled(!1, !1), this._active = !1), !e && this.vars[r] && this._callback(r), 0 === g && this._rawPrevTime === a && c !== a && (this._rawPrevTime = 0))
        }, n.to = function (t, e, i) {
            return new n(t, e, i)
        }, n.from = function (t, e, i) {
            return i.runBackwards = !0, i.immediateRender = 0 != i.immediateRender, new n(t, e, i)
        }, n.fromTo = function (t, e, i, s) {
            return s.startAt = i, s.immediateRender = 0 != s.immediateRender && 0 != i.immediateRender, new n(t, e, s)
        }, n.staggerTo = n.allTo = function (t, e, a, o, _, c, f) {
            o = o || 0;
            var p, m, d, g, v = a.delay || 0, y = [], T = function () {
                a.onComplete && a.onComplete.apply(a.onCompleteScope || this, arguments), _.apply(f || a.callbackScope || this, c || u)
            }, x = a.cycle, w = a.startAt && a.startAt.cycle;
            for (h(t) || ("string" == typeof t && (t = i.selector(t) || t), l(t) && (t = s(t))), t = t || [], 0 > o && (t = s(t), t.reverse(), o *= -1), p = t.length - 1, d = 0; p >= d; d++) {
                m = {};
                for (g in a) m[g] = a[g];
                if (x && r(m, t, d), w) {
                    w = m.startAt = {};
                    for (g in a.startAt) w[g] = a.startAt[g];
                    r(m.startAt, t, d)
                }
                m.delay = v, d === p && _ && (m.onComplete = T), y[d] = new n(t[d], e, m), v += o
            }
            return y
        }, n.staggerFrom = n.allFrom = function (t, e, i, s, r, a, o) {
            return i.runBackwards = !0, i.immediateRender = 0 != i.immediateRender, n.staggerTo(t, e, i, s, r, a, o)
        }, n.staggerFromTo = n.allFromTo = function (t, e, i, s, r, a, o, l) {
            return s.startAt = i, s.immediateRender = 0 != s.immediateRender && 0 != i.immediateRender, n.staggerTo(t, e, s, r, a, o, l)
        }, n.delayedCall = function (t, e, i, s, r) {
            return new n(e, 0, {
                delay: t,
                onComplete: e,
                onCompleteParams: i,
                callbackScope: s,
                onReverseComplete: e,
                onReverseCompleteParams: i,
                immediateRender: !1,
                useFrames: r,
                overwrite: 0
            })
        }, n.set = function (t, e) {
            return new n(t, 0, e)
        }, n.isTweening = function (t) {
            return i.getTweensOf(t, !0).length > 0
        };
        var c = function (t, e) {
            for (var s = [], r = 0, n = t._first; n;) n instanceof i ? s[r++] = n : (e && (s[r++] = n), s = s.concat(c(n, e)), r = s.length), n = n._next;
            return s
        }, f = n.getAllTweens = function (e) {
            return c(t._rootTimeline, e).concat(c(t._rootFramesTimeline, e))
        };
        n.killAll = function (t, i, s, r) {
            null == i && (i = !0), null == s && (s = !0);
            var n, a, o, l = f(0 != r), h = l.length, _ = i && s && r;
            for (o = 0; h > o; o++) a = l[o], (_ || a instanceof e || (n = a.target === a.vars.onComplete) && s || i && !n) && (t ? a.totalTime(a._reversed ? 0 : a.totalDuration()) : a._enabled(!1, !1))
        }, n.killChildTweensOf = function (t, e) {
            if (null != t) {
                var r, a, _, u, c, f = o.tweenLookup;
                if ("string" == typeof t && (t = i.selector(t) || t), l(t) && (t = s(t)), h(t)) for (u = t.length; --u > -1;) n.killChildTweensOf(t[u], e); else {
                    r = [];
                    for (_ in f) for (a = f[_].target.parentNode; a;) a === t && (r = r.concat(f[_].tweens)), a = a.parentNode;
                    for (c = r.length, u = 0; c > u; u++) e && r[u].totalTime(r[u].totalDuration()), r[u]._enabled(!1, !1)
                }
            }
        };
        var p = function (t, i, s, r) {
            i = i !== !1, s = s !== !1, r = r !== !1;
            for (var n, a, o = f(r), l = i && s && r, h = o.length; --h > -1;) a = o[h], (l || a instanceof e || (n = a.target === a.vars.onComplete) && s || i && !n) && a.paused(t)
        };
        return n.pauseAll = function (t, e, i) {
            p(!0, t, e, i)
        }, n.resumeAll = function (t, e, i) {
            p(!1, t, e, i)
        }, n.globalTimeScale = function (e) {
            var s = t._rootTimeline, r = i.ticker.time;
            return arguments.length ? (e = e || a, s._startTime = r - (r - s._startTime) * s._timeScale / e, s = t._rootFramesTimeline, r = i.ticker.frame, s._startTime = r - (r - s._startTime) * s._timeScale / e, s._timeScale = t._rootTimeline._timeScale = e, e) : s._timeScale
        }, _.progress = function (t) {
            return arguments.length ? this.totalTime(this.duration() * (this._yoyo && 0 !== (1 & this._cycle) ? 1 - t : t) + this._cycle * (this._duration + this._repeatDelay), !1) : this._time / this.duration()
        }, _.totalProgress = function (t) {
            return arguments.length ? this.totalTime(this.totalDuration() * t, !1) : this._totalTime / this.totalDuration()
        }, _.time = function (t, e) {
            return arguments.length ? (this._dirty && this.totalDuration(), t > this._duration && (t = this._duration), this._yoyo && 0 !== (1 & this._cycle) ? t = this._duration - t + this._cycle * (this._duration + this._repeatDelay) : 0 !== this._repeat && (t += this._cycle * (this._duration + this._repeatDelay)), this.totalTime(t, e)) : this._time
        }, _.duration = function (e) {
            return arguments.length ? t.prototype.duration.call(this, e) : this._duration
        }, _.totalDuration = function (t) {
            return arguments.length ? -1 === this._repeat ? this : this.duration((t - this._repeat * this._repeatDelay) / (this._repeat + 1)) : (this._dirty && (this._totalDuration = -1 === this._repeat ? 999999999999 : this._duration * (this._repeat + 1) + this._repeatDelay * this._repeat, this._dirty = !1), this._totalDuration)
        }, _.repeat = function (t) {
            return arguments.length ? (this._repeat = t, this._uncache(!0)) : this._repeat
        }, _.repeatDelay = function (t) {
            return arguments.length ? (this._repeatDelay = t, this._uncache(!0)) : this._repeatDelay
        }, _.yoyo = function (t) {
            return arguments.length ? (this._yoyo = t, this) : this._yoyo
        }, n
    }, !0), _gsScope._gsDefine("TimelineLite", ["core.Animation", "core.SimpleTimeline", "TweenLite"], function (t, e, i) {
        var s = function (t) {
                e.call(this, t), this._labels = {}, this.autoRemoveChildren = this.vars.autoRemoveChildren === !0, this.smoothChildTiming = this.vars.smoothChildTiming === !0, this._sortChildren = !0, this._onUpdate = this.vars.onUpdate;
                var i, s, r = this.vars;
                for (s in r) i = r[s], l(i) && -1 !== i.join("").indexOf("{self}") && (r[s] = this._swapSelfInParams(i));
                l(r.tweens) && this.add(r.tweens, 0, r.align, r.stagger)
            }, r = 1e-10, n = i._internals, a = s._internals = {}, o = n.isSelector, l = n.isArray, h = n.lazyTweens,
            _ = n.lazyRender, u = _gsScope._gsDefine.globals, c = function (t) {
                var e, i = {};
                for (e in t) i[e] = t[e];
                return i
            }, f = function (t, e, i) {
                var s, r, n = t.cycle;
                for (s in n) r = n[s], t[s] = "function" == typeof r ? r.call(e[i], i) : r[i % r.length];
                delete t.cycle
            }, p = a.pauseCallback = function () {
            }, m = function (t) {
                var e, i = [], s = t.length;
                for (e = 0; e !== s; i.push(t[e++])) ;
                return i
            }, d = s.prototype = new e;
        return s.version = "1.18.0", d.constructor = s, d.kill()._gc = d._forcingPlayhead = d._hasPause = !1, d.to = function (t, e, s, r) {
            var n = s.repeat && u.TweenMax || i;
            return e ? this.add(new n(t, e, s), r) : this.set(t, s, r)
        }, d.from = function (t, e, s, r) {
            return this.add((s.repeat && u.TweenMax || i).from(t, e, s), r)
        }, d.fromTo = function (t, e, s, r, n) {
            var a = r.repeat && u.TweenMax || i;
            return e ? this.add(a.fromTo(t, e, s, r), n) : this.set(t, r, n)
        }, d.staggerTo = function (t, e, r, n, a, l, h, _) {
            var u, p, d = new s({
                onComplete: l,
                onCompleteParams: h,
                callbackScope: _,
                smoothChildTiming: this.smoothChildTiming
            }), g = r.cycle;
            for ("string" == typeof t && (t = i.selector(t) || t), t = t || [], o(t) && (t = m(t)), n = n || 0, 0 > n && (t = m(t), t.reverse(), n *= -1), p = 0; t.length > p; p++) u = c(r), u.startAt && (u.startAt = c(u.startAt), u.startAt.cycle && f(u.startAt, t, p)), g && f(u, t, p), d.to(t[p], e, u, p * n);
            return this.add(d, a)
        }, d.staggerFrom = function (t, e, i, s, r, n, a, o) {
            return i.immediateRender = 0 != i.immediateRender, i.runBackwards = !0, this.staggerTo(t, e, i, s, r, n, a, o)
        }, d.staggerFromTo = function (t, e, i, s, r, n, a, o, l) {
            return s.startAt = i, s.immediateRender = 0 != s.immediateRender && 0 != i.immediateRender, this.staggerTo(t, e, s, r, n, a, o, l)
        }, d.call = function (t, e, s, r) {
            return this.add(i.delayedCall(0, t, e, s), r)
        }, d.set = function (t, e, s) {
            return s = this._parseTimeOrLabel(s, 0, !0), null == e.immediateRender && (e.immediateRender = s === this._time && !this._paused), this.add(new i(t, 0, e), s)
        }, s.exportRoot = function (t, e) {
            t = t || {}, null == t.smoothChildTiming && (t.smoothChildTiming = !0);
            var r, n, a = new s(t), o = a._timeline;
            for (null == e && (e = !0), o._remove(a, !0), a._startTime = 0, a._rawPrevTime = a._time = a._totalTime = o._time, r = o._first; r;) n = r._next, e && r instanceof i && r.target === r.vars.onComplete || a.add(r, r._startTime - r._delay), r = n;
            return o.add(a, 0), a
        }, d.add = function (r, n, a, o) {
            var h, _, u, c, f, p;
            if ("number" != typeof n && (n = this._parseTimeOrLabel(n, 0, !0, r)), !(r instanceof t)) {
                if (r instanceof Array || r && r.push && l(r)) {
                    for (a = a || "normal", o = o || 0, h = n, _ = r.length, u = 0; _ > u; u++) l(c = r[u]) && (c = new s({tweens: c})), this.add(c, h), "string" != typeof c && "function" != typeof c && ("sequence" === a ? h = c._startTime + c.totalDuration() / c._timeScale : "start" === a && (c._startTime -= c.delay())), h += o;
                    return this._uncache(!0)
                }
                if ("string" == typeof r) return this.addLabel(r, n);
                if ("function" != typeof r) throw"Cannot add " + r + " into the timeline; it is not a tween, timeline, function, or string.";
                r = i.delayedCall(0, r)
            }
            if (e.prototype.add.call(this, r, n), (this._gc || this._time === this._duration) && !this._paused && this._duration < this.duration()) for (f = this, p = f.rawTime() > r._startTime; f._timeline;) p && f._timeline.smoothChildTiming ? f.totalTime(f._totalTime, !0) : f._gc && f._enabled(!0, !1), f = f._timeline;
            return this
        }, d.remove = function (e) {
            if (e instanceof t) {
                this._remove(e, !1);
                var i = e._timeline = e.vars.useFrames ? t._rootFramesTimeline : t._rootTimeline;
                return e._startTime = (e._paused ? e._pauseTime : i._time) - (e._reversed ? e.totalDuration() - e._totalTime : e._totalTime) / e._timeScale, this
            }
            if (e instanceof Array || e && e.push && l(e)) {
                for (var s = e.length; --s > -1;) this.remove(e[s]);
                return this
            }
            return "string" == typeof e ? this.removeLabel(e) : this.kill(null, e)
        }, d._remove = function (t, i) {
            e.prototype._remove.call(this, t, i);
            var s = this._last;
            return s ? this._time > s._startTime + s._totalDuration / s._timeScale && (this._time = this.duration(), this._totalTime = this._totalDuration) : this._time = this._totalTime = this._duration = this._totalDuration = 0, this
        }, d.append = function (t, e) {
            return this.add(t, this._parseTimeOrLabel(null, e, !0, t))
        }, d.insert = d.insertMultiple = function (t, e, i, s) {
            return this.add(t, e || 0, i, s)
        }, d.appendMultiple = function (t, e, i, s) {
            return this.add(t, this._parseTimeOrLabel(null, e, !0, t), i, s)
        }, d.addLabel = function (t, e) {
            return this._labels[t] = this._parseTimeOrLabel(e), this
        }, d.addPause = function (t, e, s, r) {
            var n = i.delayedCall(0, p, s, r || this);
            return n.vars.onComplete = n.vars.onReverseComplete = e, n.data = "isPause", this._hasPause = !0, this.add(n, t)
        }, d.removeLabel = function (t) {
            return delete this._labels[t], this
        }, d.getLabelTime = function (t) {
            return null != this._labels[t] ? this._labels[t] : -1
        }, d._parseTimeOrLabel = function (e, i, s, r) {
            var n;
            if (r instanceof t && r.timeline === this) this.remove(r); else if (r && (r instanceof Array || r.push && l(r))) for (n = r.length; --n > -1;) r[n] instanceof t && r[n].timeline === this && this.remove(r[n]);
            if ("string" == typeof i) return this._parseTimeOrLabel(i, s && "number" == typeof e && null == this._labels[i] ? e - this.duration() : 0, s);
            if (i = i || 0, "string" != typeof e || !isNaN(e) && null == this._labels[e]) null == e && (e = this.duration()); else {
                if (n = e.indexOf("="), -1 === n) return null == this._labels[e] ? s ? this._labels[e] = this.duration() + i : i : this._labels[e] + i;
                i = parseInt(e.charAt(n - 1) + "1", 10) * Number(e.substr(n + 1)), e = n > 1 ? this._parseTimeOrLabel(e.substr(0, n - 1), 0, s) : this.duration()
            }
            return Number(e) + i
        }, d.seek = function (t, e) {
            return this.totalTime("number" == typeof t ? t : this._parseTimeOrLabel(t), e !== !1)
        }, d.stop = function () {
            return this.paused(!0)
        }, d.gotoAndPlay = function (t, e) {
            return this.play(t, e)
        }, d.gotoAndStop = function (t, e) {
            return this.pause(t, e)
        }, d.render = function (t, e, i) {
            this._gc && this._enabled(!0, !1);
            var s, n, a, o, l, u, c = this._dirty ? this.totalDuration() : this._totalDuration, f = this._time,
                p = this._startTime, m = this._timeScale, d = this._paused;
            if (t >= c) this._totalTime = this._time = c, this._reversed || this._hasPausedChild() || (n = !0, o = "onComplete", l = !!this._timeline.autoRemoveChildren, 0 === this._duration && (0 === t || 0 > this._rawPrevTime || this._rawPrevTime === r) && this._rawPrevTime !== t && this._first && (l = !0, this._rawPrevTime > r && (o = "onReverseComplete"))), this._rawPrevTime = this._duration || !e || t || this._rawPrevTime === t ? t : r, t = c + 1e-4; else if (1e-7 > t) if (this._totalTime = this._time = 0, (0 !== f || 0 === this._duration && this._rawPrevTime !== r && (this._rawPrevTime > 0 || 0 > t && this._rawPrevTime >= 0)) && (o = "onReverseComplete", n = this._reversed), 0 > t) this._active = !1, this._timeline.autoRemoveChildren && this._reversed ? (l = n = !0, o = "onReverseComplete") : this._rawPrevTime >= 0 && this._first && (l = !0), this._rawPrevTime = t; else {
                if (this._rawPrevTime = this._duration || !e || t || this._rawPrevTime === t ? t : r, 0 === t && n) for (s = this._first; s && 0 === s._startTime;) s._duration || (n = !1), s = s._next;
                t = 0, this._initted || (l = !0)
            } else {
                if (this._hasPause && !this._forcingPlayhead && !e) {
                    if (t >= f) for (s = this._first; s && t >= s._startTime && !u;) s._duration || "isPause" !== s.data || s.ratio || 0 === s._startTime && 0 === this._rawPrevTime || (u = s), s = s._next; else for (s = this._last; s && s._startTime >= t && !u;) s._duration || "isPause" === s.data && s._rawPrevTime > 0 && (u = s), s = s._prev;
                    u && (this._time = t = u._startTime, this._totalTime = t + this._cycle * (this._totalDuration + this._repeatDelay))
                }
                this._totalTime = this._time = this._rawPrevTime = t
            }
            if (this._time !== f && this._first || i || l || u) {
                if (this._initted || (this._initted = !0), this._active || !this._paused && this._time !== f && t > 0 && (this._active = !0), 0 === f && this.vars.onStart && 0 !== this._time && (e || this._callback("onStart")), this._time >= f) for (s = this._first; s && (a = s._next, !this._paused || d);) (s._active || s._startTime <= this._time && !s._paused && !s._gc) && (u === s && this.pause(), s._reversed ? s.render((s._dirty ? s.totalDuration() : s._totalDuration) - (t - s._startTime) * s._timeScale, e, i) : s.render((t - s._startTime) * s._timeScale, e, i)), s = a; else for (s = this._last; s && (a = s._prev, !this._paused || d);) {
                    if (s._active || f >= s._startTime && !s._paused && !s._gc) {
                        if (u === s) {
                            for (u = s._prev; u && u.endTime() > this._time;) u.render(u._reversed ? u.totalDuration() - (t - u._startTime) * u._timeScale : (t - u._startTime) * u._timeScale, e, i), u = u._prev;
                            u = null, this.pause()
                        }
                        s._reversed ? s.render((s._dirty ? s.totalDuration() : s._totalDuration) - (t - s._startTime) * s._timeScale, e, i) : s.render((t - s._startTime) * s._timeScale, e, i)
                    }
                    s = a
                }
                this._onUpdate && (e || (h.length && _(), this._callback("onUpdate"))), o && (this._gc || (p === this._startTime || m !== this._timeScale) && (0 === this._time || c >= this.totalDuration()) && (n && (h.length && _(), this._timeline.autoRemoveChildren && this._enabled(!1, !1), this._active = !1), !e && this.vars[o] && this._callback(o)))
            }
        }, d._hasPausedChild = function () {
            for (var t = this._first; t;) {
                if (t._paused || t instanceof s && t._hasPausedChild()) return !0;
                t = t._next
            }
            return !1
        }, d.getChildren = function (t, e, s, r) {
            r = r || -9999999999;
            for (var n = [], a = this._first, o = 0; a;) r > a._startTime || (a instanceof i ? e !== !1 && (n[o++] = a) : (s !== !1 && (n[o++] = a), t !== !1 && (n = n.concat(a.getChildren(!0, e, s)), o = n.length))), a = a._next;
            return n
        }, d.getTweensOf = function (t, e) {
            var s, r, n = this._gc, a = [], o = 0;
            for (n && this._enabled(!0, !0), s = i.getTweensOf(t), r = s.length; --r > -1;) (s[r].timeline === this || e && this._contains(s[r])) && (a[o++] = s[r]);
            return n && this._enabled(!1, !0), a
        }, d.recent = function () {
            return this._recent
        }, d._contains = function (t) {
            for (var e = t.timeline; e;) {
                if (e === this) return !0;
                e = e.timeline
            }
            return !1
        }, d.shiftChildren = function (t, e, i) {
            i = i || 0;
            for (var s, r = this._first, n = this._labels; r;) r._startTime >= i && (r._startTime += t), r = r._next;
            if (e) for (s in n) n[s] >= i && (n[s] += t);
            return this._uncache(!0)
        }, d._kill = function (t, e) {
            if (!t && !e) return this._enabled(!1, !1);
            for (var i = e ? this.getTweensOf(e) : this.getChildren(!0, !0, !1), s = i.length, r = !1; --s > -1;) i[s]._kill(t, e) && (r = !0);
            return r
        }, d.clear = function (t) {
            var e = this.getChildren(!1, !0, !0), i = e.length;
            for (this._time = this._totalTime = 0; --i > -1;) e[i]._enabled(!1, !1);
            return t !== !1 && (this._labels = {}), this._uncache(!0)
        }, d.invalidate = function () {
            for (var e = this._first; e;) e.invalidate(), e = e._next;
            return t.prototype.invalidate.call(this)
        }, d._enabled = function (t, i) {
            if (t === this._gc) for (var s = this._first; s;) s._enabled(t, !0), s = s._next;
            return e.prototype._enabled.call(this, t, i)
        }, d.totalTime = function () {
            this._forcingPlayhead = !0;
            var e = t.prototype.totalTime.apply(this, arguments);
            return this._forcingPlayhead = !1, e
        }, d.duration = function (t) {
            return arguments.length ? (0 !== this.duration() && 0 !== t && this.timeScale(this._duration / t), this) : (this._dirty && this.totalDuration(), this._duration)
        }, d.totalDuration = function (t) {
            if (!arguments.length) {
                if (this._dirty) {
                    for (var e, i, s = 0, r = this._last, n = 999999999999; r;) e = r._prev, r._dirty && r.totalDuration(), r._startTime > n && this._sortChildren && !r._paused ? this.add(r, r._startTime - r._delay) : n = r._startTime, 0 > r._startTime && !r._paused && (s -= r._startTime, this._timeline.smoothChildTiming && (this._startTime += r._startTime / this._timeScale), this.shiftChildren(-r._startTime, !1, -9999999999), n = 0), i = r._startTime + r._totalDuration / r._timeScale, i > s && (s = i), r = e;
                    this._duration = this._totalDuration = s, this._dirty = !1
                }
                return this._totalDuration
            }
            return 0 !== this.totalDuration() && 0 !== t && this.timeScale(this._totalDuration / t), this
        }, d.paused = function (e) {
            if (!e) for (var i = this._first, s = this._time; i;) i._startTime === s && "isPause" === i.data && (i._rawPrevTime = 0), i = i._next;
            return t.prototype.paused.apply(this, arguments)
        }, d.usesFrames = function () {
            for (var e = this._timeline; e._timeline;) e = e._timeline;
            return e === t._rootFramesTimeline
        }, d.rawTime = function () {
            return this._paused ? this._totalTime : (this._timeline.rawTime() - this._startTime) * this._timeScale
        }, s
    }, !0), _gsScope._gsDefine("TimelineMax", ["TimelineLite", "TweenLite", "easing.Ease"], function (t, e, i) {
        var s = function (e) {
                t.call(this, e), this._repeat = this.vars.repeat || 0, this._repeatDelay = this.vars.repeatDelay || 0, this._cycle = 0, this._yoyo = this.vars.yoyo === !0, this._dirty = !0
            }, r = 1e-10, n = e._internals, a = n.lazyTweens, o = n.lazyRender, l = new i(null, null, 1, 0),
            h = s.prototype = new t;
        return h.constructor = s, h.kill()._gc = !1, s.version = "1.18.0", h.invalidate = function () {
            return this._yoyo = this.vars.yoyo === !0, this._repeat = this.vars.repeat || 0, this._repeatDelay = this.vars.repeatDelay || 0, this._uncache(!0), t.prototype.invalidate.call(this)
        }, h.addCallback = function (t, i, s, r) {
            return this.add(e.delayedCall(0, t, s, r), i)
        }, h.removeCallback = function (t, e) {
            if (t) if (null == e) this._kill(null, t); else for (var i = this.getTweensOf(t, !1), s = i.length, r = this._parseTimeOrLabel(e); --s > -1;) i[s]._startTime === r && i[s]._enabled(!1, !1);
            return this
        }, h.removePause = function (e) {
            return this.removeCallback(t._internals.pauseCallback, e)
        }, h.tweenTo = function (t, i) {
            i = i || {};
            var s, r, n, a = {ease: l, useFrames: this.usesFrames(), immediateRender: !1};
            for (r in i) a[r] = i[r];
            return a.time = this._parseTimeOrLabel(t), s = Math.abs(Number(a.time) - this._time) / this._timeScale || .001, n = new e(this, s, a), a.onStart = function () {
                n.target.paused(!0), n.vars.time !== n.target.time() && s === n.duration() && n.duration(Math.abs(n.vars.time - n.target.time()) / n.target._timeScale), i.onStart && n._callback("onStart")
            }, n
        }, h.tweenFromTo = function (t, e, i) {
            i = i || {}, t = this._parseTimeOrLabel(t), i.startAt = {
                onComplete: this.seek,
                onCompleteParams: [t],
                callbackScope: this
            }, i.immediateRender = i.immediateRender !== !1;
            var s = this.tweenTo(e, i);
            return s.duration(Math.abs(s.vars.time - t) / this._timeScale || .001)
        }, h.render = function (t, e, i) {
            this._gc && this._enabled(!0, !1);
            var s, n, l, h, _, u, c, f = this._dirty ? this.totalDuration() : this._totalDuration, p = this._duration,
                m = this._time, d = this._totalTime, g = this._startTime, v = this._timeScale, y = this._rawPrevTime,
                T = this._paused, x = this._cycle;
            if (t >= f) this._locked || (this._totalTime = f, this._cycle = this._repeat), this._reversed || this._hasPausedChild() || (n = !0, h = "onComplete", _ = !!this._timeline.autoRemoveChildren, 0 === this._duration && (0 === t || 0 > y || y === r) && y !== t && this._first && (_ = !0, y > r && (h = "onReverseComplete"))), this._rawPrevTime = this._duration || !e || t || this._rawPrevTime === t ? t : r, this._yoyo && 0 !== (1 & this._cycle) ? this._time = t = 0 : (this._time = p, t = p + 1e-4); else if (1e-7 > t) if (this._locked || (this._totalTime = this._cycle = 0), this._time = 0, (0 !== m || 0 === p && y !== r && (y > 0 || 0 > t && y >= 0) && !this._locked) && (h = "onReverseComplete", n = this._reversed), 0 > t) this._active = !1, this._timeline.autoRemoveChildren && this._reversed ? (_ = n = !0, h = "onReverseComplete") : y >= 0 && this._first && (_ = !0), this._rawPrevTime = t; else {
                if (this._rawPrevTime = p || !e || t || this._rawPrevTime === t ? t : r, 0 === t && n) for (s = this._first; s && 0 === s._startTime;) s._duration || (n = !1), s = s._next;
                t = 0, this._initted || (_ = !0)
            } else if (0 === p && 0 > y && (_ = !0), this._time = this._rawPrevTime = t, this._locked || (this._totalTime = t, 0 !== this._repeat && (u = p + this._repeatDelay, this._cycle = this._totalTime / u >> 0, 0 !== this._cycle && this._cycle === this._totalTime / u && this._cycle--, this._time = this._totalTime - this._cycle * u, this._yoyo && 0 !== (1 & this._cycle) && (this._time = p - this._time), this._time > p ? (this._time = p, t = p + 1e-4) : 0 > this._time ? this._time = t = 0 : t = this._time)), this._hasPause && !this._forcingPlayhead && !e) {
                if (t = this._time, t >= m) for (s = this._first; s && t >= s._startTime && !c;) s._duration || "isPause" !== s.data || s.ratio || 0 === s._startTime && 0 === this._rawPrevTime || (c = s), s = s._next; else for (s = this._last; s && s._startTime >= t && !c;) s._duration || "isPause" === s.data && s._rawPrevTime > 0 && (c = s), s = s._prev;
                c && (this._time = t = c._startTime, this._totalTime = t + this._cycle * (this._totalDuration + this._repeatDelay))
            }
            if (this._cycle !== x && !this._locked) {
                var w = this._yoyo && 0 !== (1 & x), b = w === (this._yoyo && 0 !== (1 & this._cycle)),
                    P = this._totalTime, k = this._cycle, S = this._rawPrevTime, R = this._time;
                if (this._totalTime = x * p, x > this._cycle ? w = !w : this._totalTime += p, this._time = m, this._rawPrevTime = 0 === p ? y - 1e-4 : y, this._cycle = x, this._locked = !0, m = w ? 0 : p, this.render(m, e, 0 === p), e || this._gc || this.vars.onRepeat && this._callback("onRepeat"), b && (m = w ? p + 1e-4 : -1e-4, this.render(m, !0, !1)), this._locked = !1, this._paused && !T) return;
                this._time = R, this._totalTime = P, this._cycle = k, this._rawPrevTime = S
            }
            if (!(this._time !== m && this._first || i || _ || c)) return d !== this._totalTime && this._onUpdate && (e || this._callback("onUpdate")), void 0;
            if (this._initted || (this._initted = !0), this._active || !this._paused && this._totalTime !== d && t > 0 && (this._active = !0), 0 === d && this.vars.onStart && 0 !== this._totalTime && (e || this._callback("onStart")), this._time >= m) for (s = this._first; s && (l = s._next, !this._paused || T);) (s._active || s._startTime <= this._time && !s._paused && !s._gc) && (c === s && this.pause(), s._reversed ? s.render((s._dirty ? s.totalDuration() : s._totalDuration) - (t - s._startTime) * s._timeScale, e, i) : s.render((t - s._startTime) * s._timeScale, e, i)), s = l; else for (s = this._last; s && (l = s._prev, !this._paused || T);) {
                if (s._active || m >= s._startTime && !s._paused && !s._gc) {
                    if (c === s) {
                        for (c = s._prev; c && c.endTime() > this._time;) c.render(c._reversed ? c.totalDuration() - (t - c._startTime) * c._timeScale : (t - c._startTime) * c._timeScale, e, i), c = c._prev;
                        c = null, this.pause()
                    }
                    s._reversed ? s.render((s._dirty ? s.totalDuration() : s._totalDuration) - (t - s._startTime) * s._timeScale, e, i) : s.render((t - s._startTime) * s._timeScale, e, i)
                }
                s = l
            }
            this._onUpdate && (e || (a.length && o(), this._callback("onUpdate"))), h && (this._locked || this._gc || (g === this._startTime || v !== this._timeScale) && (0 === this._time || f >= this.totalDuration()) && (n && (a.length && o(), this._timeline.autoRemoveChildren && this._enabled(!1, !1), this._active = !1), !e && this.vars[h] && this._callback(h)))
        }, h.getActive = function (t, e, i) {
            null == t && (t = !0), null == e && (e = !0), null == i && (i = !1);
            var s, r, n = [], a = this.getChildren(t, e, i), o = 0, l = a.length;
            for (s = 0; l > s; s++) r = a[s], r.isActive() && (n[o++] = r);
            return n
        }, h.getLabelAfter = function (t) {
            t || 0 !== t && (t = this._time);
            var e, i = this.getLabelsArray(), s = i.length;
            for (e = 0; s > e; e++) if (i[e].time > t) return i[e].name;
            return null
        }, h.getLabelBefore = function (t) {
            null == t && (t = this._time);
            for (var e = this.getLabelsArray(), i = e.length; --i > -1;) if (t > e[i].time) return e[i].name;
            return null
        }, h.getLabelsArray = function () {
            var t, e = [], i = 0;
            for (t in this._labels) e[i++] = {time: this._labels[t], name: t};
            return e.sort(function (t, e) {
                return t.time - e.time
            }), e
        }, h.progress = function (t, e) {
            return arguments.length ? this.totalTime(this.duration() * (this._yoyo && 0 !== (1 & this._cycle) ? 1 - t : t) + this._cycle * (this._duration + this._repeatDelay), e) : this._time / this.duration()
        }, h.totalProgress = function (t, e) {
            return arguments.length ? this.totalTime(this.totalDuration() * t, e) : this._totalTime / this.totalDuration()
        }, h.totalDuration = function (e) {
            return arguments.length ? -1 === this._repeat ? this : this.duration((e - this._repeat * this._repeatDelay) / (this._repeat + 1)) : (this._dirty && (t.prototype.totalDuration.call(this), this._totalDuration = -1 === this._repeat ? 999999999999 : this._duration * (this._repeat + 1) + this._repeatDelay * this._repeat), this._totalDuration)
        }, h.time = function (t, e) {
            return arguments.length ? (this._dirty && this.totalDuration(), t > this._duration && (t = this._duration), this._yoyo && 0 !== (1 & this._cycle) ? t = this._duration - t + this._cycle * (this._duration + this._repeatDelay) : 0 !== this._repeat && (t += this._cycle * (this._duration + this._repeatDelay)), this.totalTime(t, e)) : this._time
        }, h.repeat = function (t) {
            return arguments.length ? (this._repeat = t, this._uncache(!0)) : this._repeat
        }, h.repeatDelay = function (t) {
            return arguments.length ? (this._repeatDelay = t, this._uncache(!0)) : this._repeatDelay
        }, h.yoyo = function (t) {
            return arguments.length ? (this._yoyo = t, this) : this._yoyo
        }, h.currentLabel = function (t) {
            return arguments.length ? this.seek(t, !0) : this.getLabelBefore(this._time + 1e-8)
        }, s
    }, !0), function () {
        var t = 180 / Math.PI, e = [], i = [], s = [], r = {}, n = _gsScope._gsDefine.globals,
            a = function (t, e, i, s) {
                this.a = t, this.b = e, this.c = i, this.d = s, this.da = s - t, this.ca = i - t, this.ba = e - t
            },
            o = ",x,y,z,left,top,right,bottom,marginTop,marginLeft,marginRight,marginBottom,paddingLeft,paddingTop,paddingRight,paddingBottom,backgroundPosition,backgroundPosition_y,",
            l = function (t, e, i, s) {
                var r = {a: t}, n = {}, a = {}, o = {c: s}, l = (t + e) / 2, h = (e + i) / 2, _ = (i + s) / 2,
                    u = (l + h) / 2, c = (h + _) / 2, f = (c - u) / 8;
                return r.b = l + (t - l) / 4, n.b = u + f, r.c = n.a = (r.b + n.b) / 2, n.c = a.a = (u + c) / 2, a.b = c - f, o.b = _ + (s - _) / 4, a.c = o.a = (a.b + o.b) / 2, [r, n, a, o]
            }, h = function (t, r, n, a, o) {
                var h, _, u, c, f, p, m, d, g, v, y, T, x, w = t.length - 1, b = 0, P = t[0].a;
                for (h = 0; w > h; h++) f = t[b], _ = f.a, u = f.d, c = t[b + 1].d, o ? (y = e[h], T = i[h], x = .25 * (T + y) * r / (a ? .5 : s[h] || .5), p = u - (u - _) * (a ? .5 * r : 0 !== y ? x / y : 0), m = u + (c - u) * (a ? .5 * r : 0 !== T ? x / T : 0), d = u - (p + ((m - p) * (3 * y / (y + T) + .5) / 4 || 0))) : (p = u - .5 * (u - _) * r, m = u + .5 * (c - u) * r, d = u - (p + m) / 2), p += d, m += d, f.c = g = p, f.b = 0 !== h ? P : P = f.a + .6 * (f.c - f.a), f.da = u - _, f.ca = g - _, f.ba = P - _, n ? (v = l(_, P, g, u), t.splice(b, 1, v[0], v[1], v[2], v[3]), b += 4) : b++, P = m;
                f = t[b], f.b = P, f.c = P + .4 * (f.d - P), f.da = f.d - f.a, f.ca = f.c - f.a, f.ba = P - f.a, n && (v = l(f.a, P, f.c, f.d), t.splice(b, 1, v[0], v[1], v[2], v[3]))
            }, _ = function (t, s, r, n) {
                var o, l, h, _, u, c, f = [];
                if (n) for (t = [n].concat(t), l = t.length; --l > -1;) "string" == typeof (c = t[l][s]) && "=" === c.charAt(1) && (t[l][s] = n[s] + Number(c.charAt(0) + c.substr(2)));
                if (o = t.length - 2, 0 > o) return f[0] = new a(t[0][s], 0, 0, t[-1 > o ? 0 : 1][s]), f;
                for (l = 0; o > l; l++) h = t[l][s], _ = t[l + 1][s], f[l] = new a(h, 0, 0, _), r && (u = t[l + 2][s], e[l] = (e[l] || 0) + (_ - h) * (_ - h), i[l] = (i[l] || 0) + (u - _) * (u - _));
                return f[l] = new a(t[l][s], 0, 0, t[l + 1][s]), f
            }, u = function (t, n, a, l, u, c) {
                var f, p, m, d, g, v, y, T, x = {}, w = [], b = c || t[0];
                u = "string" == typeof u ? "," + u + "," : o, null == n && (n = 1);
                for (p in t[0]) w.push(p);
                if (t.length > 1) {
                    for (T = t[t.length - 1], y = !0, f = w.length; --f > -1;) if (p = w[f], Math.abs(b[p] - T[p]) > .05) {
                        y = !1;
                        break
                    }
                    y && (t = t.concat(), c && t.unshift(c), t.push(t[1]), c = t[t.length - 3])
                }
                for (e.length = i.length = s.length = 0, f = w.length; --f > -1;) p = w[f], r[p] = -1 !== u.indexOf("," + p + ","), x[p] = _(t, p, r[p], c);
                for (f = e.length; --f > -1;) e[f] = Math.sqrt(e[f]), i[f] = Math.sqrt(i[f]);
                if (!l) {
                    for (f = w.length; --f > -1;) if (r[p]) for (m = x[w[f]], v = m.length - 1, d = 0; v > d; d++) g = m[d + 1].da / i[d] + m[d].da / e[d], s[d] = (s[d] || 0) + g * g;
                    for (f = s.length; --f > -1;) s[f] = Math.sqrt(s[f])
                }
                for (f = w.length, d = a ? 4 : 1; --f > -1;) p = w[f], m = x[p], h(m, n, a, l, r[p]), y && (m.splice(0, d), m.splice(m.length - d, d));
                return x
            }, c = function (t, e, i) {
                e = e || "soft";
                var s, r, n, o, l, h, _, u, c, f, p, m = {}, d = "cubic" === e ? 3 : 2, g = "soft" === e, v = [];
                if (g && i && (t = [i].concat(t)), null == t || d + 1 > t.length) throw"invalid Bezier data";
                for (c in t[0]) v.push(c);
                for (h = v.length; --h > -1;) {
                    for (c = v[h], m[c] = l = [], f = 0, u = t.length, _ = 0; u > _; _++) s = null == i ? t[_][c] : "string" == typeof (p = t[_][c]) && "=" === p.charAt(1) ? i[c] + Number(p.charAt(0) + p.substr(2)) : Number(p), g && _ > 1 && u - 1 > _ && (l[f++] = (s + l[f - 2]) / 2), l[f++] = s;
                    for (u = f - d + 1, f = 0, _ = 0; u > _; _ += d) s = l[_], r = l[_ + 1], n = l[_ + 2], o = 2 === d ? 0 : l[_ + 3], l[f++] = p = 3 === d ? new a(s, r, n, o) : new a(s, (2 * r + s) / 3, (2 * r + n) / 3, n);
                    l.length = f
                }
                return m
            }, f = function (t, e, i) {
                for (var s, r, n, a, o, l, h, _, u, c, f, p = 1 / i, m = t.length; --m > -1;) for (c = t[m], n = c.a, a = c.d - n, o = c.c - n, l = c.b - n, s = r = 0, _ = 1; i >= _; _++) h = p * _, u = 1 - h, s = r - (r = (h * h * a + 3 * u * (h * o + u * l)) * h), f = m * i + _ - 1, e[f] = (e[f] || 0) + s * s
            }, p = function (t, e) {
                e = e >> 0 || 6;
                var i, s, r, n, a = [], o = [], l = 0, h = 0, _ = e - 1, u = [], c = [];
                for (i in t) f(t[i], a, e);
                for (r = a.length, s = 0; r > s; s++) l += Math.sqrt(a[s]), n = s % e, c[n] = l, n === _ && (h += l, n = s / e >> 0, u[n] = c, o[n] = h, l = 0, c = []);
                return {length: h, lengths: o, segments: u}
            }, m = _gsScope._gsDefine.plugin({
                propName: "bezier", priority: -1, version: "1.3.4", API: 2, global: !0, init: function (t, e, i) {
                    this._target = t, e instanceof Array && (e = {values: e}), this._func = {}, this._round = {}, this._props = [], this._timeRes = null == e.timeResolution ? 6 : parseInt(e.timeResolution, 10);
                    var s, r, n, a, o, l = e.values || [], h = {}, _ = l[0], f = e.autoRotate || i.vars.orientToBezier;
                    this._autoRotate = f ? f instanceof Array ? f : [["x", "y", "rotation", f === !0 ? 0 : Number(f) || 0]] : null;
                    for (s in _) this._props.push(s);
                    for (n = this._props.length; --n > -1;) s = this._props[n], this._overwriteProps.push(s), r = this._func[s] = "function" == typeof t[s], h[s] = r ? t[s.indexOf("set") || "function" != typeof t["get" + s.substr(3)] ? s : "get" + s.substr(3)]() : parseFloat(t[s]), o || h[s] !== l[0][s] && (o = h);
                    if (this._beziers = "cubic" !== e.type && "quadratic" !== e.type && "soft" !== e.type ? u(l, isNaN(e.curviness) ? 1 : e.curviness, !1, "thruBasic" === e.type, e.correlate, o) : c(l, e.type, h), this._segCount = this._beziers[s].length, this._timeRes) {
                        var m = p(this._beziers, this._timeRes);
                        this._length = m.length, this._lengths = m.lengths, this._segments = m.segments, this._l1 = this._li = this._s1 = this._si = 0, this._l2 = this._lengths[0], this._curSeg = this._segments[0], this._s2 = this._curSeg[0], this._prec = 1 / this._curSeg.length
                    }
                    if (f = this._autoRotate) for (this._initialRotations = [], f[0] instanceof Array || (this._autoRotate = f = [f]), n = f.length; --n > -1;) {
                        for (a = 0; 3 > a; a++) s = f[n][a], this._func[s] = "function" == typeof t[s] ? t[s.indexOf("set") || "function" != typeof t["get" + s.substr(3)] ? s : "get" + s.substr(3)] : !1;
                        s = f[n][2], this._initialRotations[n] = this._func[s] ? this._func[s].call(this._target) : this._target[s]
                    }
                    return this._startRatio = i.vars.runBackwards ? 1 : 0, !0
                }, set: function (e) {
                    var i, s, r, n, a, o, l, h, _, u, c = this._segCount, f = this._func, p = this._target,
                        m = e !== this._startRatio;
                    if (this._timeRes) {
                        if (_ = this._lengths, u = this._curSeg, e *= this._length, r = this._li, e > this._l2 && c - 1 > r) {
                            for (h = c - 1; h > r && e >= (this._l2 = _[++r]);) ;
                            this._l1 = _[r - 1], this._li = r, this._curSeg = u = this._segments[r], this._s2 = u[this._s1 = this._si = 0]
                        } else if (this._l1 > e && r > 0) {
                            for (; r > 0 && (this._l1 = _[--r]) >= e;) ;
                            0 === r && this._l1 > e ? this._l1 = 0 : r++, this._l2 = _[r], this._li = r, this._curSeg = u = this._segments[r], this._s1 = u[(this._si = u.length - 1) - 1] || 0, this._s2 = u[this._si]
                        }
                        if (i = r, e -= this._l1, r = this._si, e > this._s2 && u.length - 1 > r) {
                            for (h = u.length - 1; h > r && e >= (this._s2 = u[++r]);) ;
                            this._s1 = u[r - 1], this._si = r
                        } else if (this._s1 > e && r > 0) {
                            for (; r > 0 && (this._s1 = u[--r]) >= e;) ;
                            0 === r && this._s1 > e ? this._s1 = 0 : r++, this._s2 = u[r], this._si = r
                        }
                        o = (r + (e - this._s1) / (this._s2 - this._s1)) * this._prec
                    } else i = 0 > e ? 0 : e >= 1 ? c - 1 : c * e >> 0, o = (e - i * (1 / c)) * c;
                    for (s = 1 - o, r = this._props.length; --r > -1;) n = this._props[r], a = this._beziers[n][i], l = (o * o * a.da + 3 * s * (o * a.ca + s * a.ba)) * o + a.a, this._round[n] && (l = Math.round(l)), f[n] ? p[n](l) : p[n] = l;
                    if (this._autoRotate) {
                        var d, g, v, y, T, x, w, b = this._autoRotate;
                        for (r = b.length; --r > -1;) n = b[r][2], x = b[r][3] || 0, w = b[r][4] === !0 ? 1 : t, a = this._beziers[b[r][0]], d = this._beziers[b[r][1]], a && d && (a = a[i], d = d[i], g = a.a + (a.b - a.a) * o, y = a.b + (a.c - a.b) * o, g += (y - g) * o, y += (a.c + (a.d - a.c) * o - y) * o, v = d.a + (d.b - d.a) * o, T = d.b + (d.c - d.b) * o, v += (T - v) * o, T += (d.c + (d.d - d.c) * o - T) * o, l = m ? Math.atan2(T - v, y - g) * w + x : this._initialRotations[r], f[n] ? p[n](l) : p[n] = l)
                    }
                }
            }), d = m.prototype;
        m.bezierThrough = u, m.cubicToQuadratic = l, m._autoCSS = !0, m.quadraticToCubic = function (t, e, i) {
            return new a(t, (2 * e + t) / 3, (2 * e + i) / 3, i)
        }, m._cssRegister = function () {
            var t = n.CSSPlugin;
            if (t) {
                var e = t._internals, i = e._parseToProxy, s = e._setPluginRatio, r = e.CSSPropTween;
                e._registerComplexSpecialProp("bezier", {
                    parser: function (t, e, n, a, o, l) {
                        e instanceof Array && (e = {values: e}), l = new m;
                        var h, _, u, c = e.values, f = c.length - 1, p = [], d = {};
                        if (0 > f) return o;
                        for (h = 0; f >= h; h++) u = i(t, c[h], a, o, l, f !== h), p[h] = u.end;
                        for (_ in e) d[_] = e[_];
                        return d.values = p, o = new r(t, "bezier", 0, 0, u.pt, 2), o.data = u, o.plugin = l, o.setRatio = s, 0 === d.autoRotate && (d.autoRotate = !0), !d.autoRotate || d.autoRotate instanceof Array || (h = d.autoRotate === !0 ? 0 : Number(d.autoRotate), d.autoRotate = null != u.end.left ? [["left", "top", "rotation", h, !1]] : null != u.end.x ? [["x", "y", "rotation", h, !1]] : !1), d.autoRotate && (a._transform || a._enableTransforms(!1), u.autoRotate = a._target._gsTransform), l._onInitTween(u.proxy, d, a._tween), o
                    }
                })
            }
        }, d._roundProps = function (t, e) {
            for (var i = this._overwriteProps, s = i.length; --s > -1;) (t[i[s]] || t.bezier || t.bezierThrough) && (this._round[i[s]] = e)
        }, d._kill = function (t) {
            var e, i, s = this._props;
            for (e in this._beziers) if (e in t) for (delete this._beziers[e], delete this._func[e], i = s.length; --i > -1;) s[i] === e && s.splice(i, 1);
            return this._super._kill.call(this, t)
        }
    }(), _gsScope._gsDefine("plugins.CSSPlugin", ["plugins.TweenPlugin", "TweenLite"], function (t, e) {
        var i, s, r, n, a = function () {
            t.call(this, "css"), this._overwriteProps.length = 0, this.setRatio = a.prototype.setRatio
        }, o = _gsScope._gsDefine.globals, l = {}, h = a.prototype = new t("css");
        h.constructor = a, a.version = "1.18.0", a.API = 2, a.defaultTransformPerspective = 0, a.defaultSkewType = "compensated", a.defaultSmoothOrigin = !0, h = "px", a.suffixMap = {
            top: h,
            right: h,
            bottom: h,
            left: h,
            width: h,
            height: h,
            fontSize: h,
            padding: h,
            margin: h,
            perspective: h,
            lineHeight: ""
        };
        var _, u, c, f, p, m, d = /(?:\d|\-\d|\.\d|\-\.\d)+/g,
            g = /(?:\d|\-\d|\.\d|\-\.\d|\+=\d|\-=\d|\+=.\d|\-=\.\d)+/g,
            v = /(?:\+=|\-=|\-|\b)[\d\-\.]+[a-zA-Z0-9]*(?:%|\b)/gi, y = /(?![+-]?\d*\.?\d+|[+-]|e[+-]\d+)[^0-9]/g,
            T = /(?:\d|\-|\+|=|#|\.)*/g, x = /opacity *= *([^)]*)/i, w = /opacity:([^;]*)/i,
            b = /alpha\(opacity *=.+?\)/i, P = /^(rgb|hsl)/, k = /([A-Z])/g, S = /-([a-z])/gi,
            R = /(^(?:url\(\"|url\())|(?:(\"\))$|\)$)/gi, O = function (t, e) {
                return e.toUpperCase()
            }, A = /(?:Left|Right|Width)/i, C = /(M11|M12|M21|M22)=[\d\-\.e]+/gi,
            D = /progid\:DXImageTransform\.Microsoft\.Matrix\(.+?\)/i, M = /,(?=[^\)]*(?:\(|$))/gi, z = Math.PI / 180,
            F = 180 / Math.PI, I = {}, E = document, N = function (t) {
                return E.createElementNS ? E.createElementNS("http://www.w3.org/1999/xhtml", t) : E.createElement(t)
            }, L = N("div"), X = N("img"), B = a._internals = {_specialProps: l}, j = navigator.userAgent, Y = function () {
                var t = j.indexOf("Android"), e = N("a");
                return c = -1 !== j.indexOf("Safari") && -1 === j.indexOf("Chrome") && (-1 === t || Number(j.substr(t + 8, 1)) > 3), p = c && 6 > Number(j.substr(j.indexOf("Version/") + 8, 1)), f = -1 !== j.indexOf("Firefox"), (/MSIE ([0-9]{1,}[\.0-9]{0,})/.exec(j) || /Trident\/.*rv:([0-9]{1,}[\.0-9]{0,})/.exec(j)) && (m = parseFloat(RegExp.$1)), e ? (e.style.cssText = "top:1px;opacity:.55;", /^0.55/.test(e.style.opacity)) : !1
            }(), U = function (t) {
                return x.test("string" == typeof t ? t : (t.currentStyle ? t.currentStyle.filter : t.style.filter) || "") ? parseFloat(RegExp.$1) / 100 : 1
            }, q = function (t) {
                window.console && console.log(t)
            }, V = "", G = "", W = function (t, e) {
                e = e || L;
                var i, s, r = e.style;
                if (void 0 !== r[t]) return t;
                for (t = t.charAt(0).toUpperCase() + t.substr(1), i = ["O", "Moz", "ms", "Ms", "Webkit"], s = 5; --s > -1 && void 0 === r[i[s] + t];) ;
                return s >= 0 ? (G = 3 === s ? "ms" : i[s], V = "-" + G.toLowerCase() + "-", G + t) : null
            }, Z = E.defaultView ? E.defaultView.getComputedStyle : function () {
            }, Q = a.getStyle = function (t, e, i, s, r) {
                var n;
                return Y || "opacity" !== e ? (!s && t.style[e] ? n = t.style[e] : (i = i || Z(t)) ? n = i[e] || i.getPropertyValue(e) || i.getPropertyValue(e.replace(k, "-$1").toLowerCase()) : t.currentStyle && (n = t.currentStyle[e]), null == r || n && "none" !== n && "auto" !== n && "auto auto" !== n ? n : r) : U(t)
            }, $ = B.convertToPixels = function (t, i, s, r, n) {
                if ("px" === r || !r) return s;
                if ("auto" === r || !s) return 0;
                var o, l, h, _ = A.test(i), u = t, c = L.style, f = 0 > s;
                if (f && (s = -s), "%" === r && -1 !== i.indexOf("border")) o = s / 100 * (_ ? t.clientWidth : t.clientHeight); else {
                    if (c.cssText = "border:0 solid red;position:" + Q(t, "position") + ";line-height:0;", "%" !== r && u.appendChild && "v" !== r.charAt(0) && "rem" !== r) c[_ ? "borderLeftWidth" : "borderTopWidth"] = s + r; else {
                        if (u = t.parentNode || E.body, l = u._gsCache, h = e.ticker.frame, l && _ && l.time === h) return l.width * s / 100;
                        c[_ ? "width" : "height"] = s + r
                    }
                    u.appendChild(L), o = parseFloat(L[_ ? "offsetWidth" : "offsetHeight"]), u.removeChild(L), _ && "%" === r && a.cacheWidths !== !1 && (l = u._gsCache = u._gsCache || {}, l.time = h, l.width = 100 * (o / s)), 0 !== o || n || (o = $(t, i, s, r, !0))
                }
                return f ? -o : o
            }, H = B.calculateOffset = function (t, e, i) {
                if ("absolute" !== Q(t, "position", i)) return 0;
                var s = "left" === e ? "Left" : "Top", r = Q(t, "margin" + s, i);
                return t["offset" + s] - ($(t, e, parseFloat(r), r.replace(T, "")) || 0)
            }, K = function (t, e) {
                var i, s, r, n = {};
                if (e = e || Z(t, null)) if (i = e.length) for (; --i > -1;) r = e[i], (-1 === r.indexOf("-transform") || ke === r) && (n[r.replace(S, O)] = e.getPropertyValue(r)); else for (i in e) (-1 === i.indexOf("Transform") || Pe === i) && (n[i] = e[i]); else if (e = t.currentStyle || t.style) for (i in e) "string" == typeof i && void 0 === n[i] && (n[i.replace(S, O)] = e[i]);
                return Y || (n.opacity = U(t)), s = Ne(t, e, !1), n.rotation = s.rotation, n.skewX = s.skewX, n.scaleX = s.scaleX, n.scaleY = s.scaleY, n.x = s.x, n.y = s.y, Re && (n.z = s.z, n.rotationX = s.rotationX, n.rotationY = s.rotationY, n.scaleZ = s.scaleZ), n.filters && delete n.filters, n
            }, J = function (t, e, i, s, r) {
                var n, a, o, l = {}, h = t.style;
                for (a in i) "cssText" !== a && "length" !== a && isNaN(a) && (e[a] !== (n = i[a]) || r && r[a]) && -1 === a.indexOf("Origin") && ("number" == typeof n || "string" == typeof n) && (l[a] = "auto" !== n || "left" !== a && "top" !== a ? "" !== n && "auto" !== n && "none" !== n || "string" != typeof e[a] || "" === e[a].replace(y, "") ? n : 0 : H(t, a), void 0 !== h[a] && (o = new pe(h, a, h[a], o)));
                if (s) for (a in s) "className" !== a && (l[a] = s[a]);
                return {difs: l, firstMPT: o}
            }, te = {width: ["Left", "Right"], height: ["Top", "Bottom"]},
            ee = ["marginLeft", "marginRight", "marginTop", "marginBottom"], ie = function (t, e, i) {
                var s = parseFloat("width" === e ? t.offsetWidth : t.offsetHeight), r = te[e], n = r.length;
                for (i = i || Z(t, null); --n > -1;) s -= parseFloat(Q(t, "padding" + r[n], i, !0)) || 0, s -= parseFloat(Q(t, "border" + r[n] + "Width", i, !0)) || 0;
                return s
            }, se = function (t, e) {
                if ("contain" === t || "auto" === t || "auto auto" === t) return t + " ";
                (null == t || "" === t) && (t = "0 0");
                var i = t.split(" "), s = -1 !== t.indexOf("left") ? "0%" : -1 !== t.indexOf("right") ? "100%" : i[0],
                    r = -1 !== t.indexOf("top") ? "0%" : -1 !== t.indexOf("bottom") ? "100%" : i[1];
                return null == r ? r = "center" === s ? "50%" : "0" : "center" === r && (r = "50%"), ("center" === s || isNaN(parseFloat(s)) && -1 === (s + "").indexOf("=")) && (s = "50%"), t = s + " " + r + (i.length > 2 ? " " + i[2] : ""), e && (e.oxp = -1 !== s.indexOf("%"), e.oyp = -1 !== r.indexOf("%"), e.oxr = "=" === s.charAt(1), e.oyr = "=" === r.charAt(1), e.ox = parseFloat(s.replace(y, "")), e.oy = parseFloat(r.replace(y, "")), e.v = t), e || t
            }, re = function (t, e) {
                return "string" == typeof t && "=" === t.charAt(1) ? parseInt(t.charAt(0) + "1", 10) * parseFloat(t.substr(2)) : parseFloat(t) - parseFloat(e)
            }, ne = function (t, e) {
                return null == t ? e : "string" == typeof t && "=" === t.charAt(1) ? parseInt(t.charAt(0) + "1", 10) * parseFloat(t.substr(2)) + e : parseFloat(t)
            }, ae = function (t, e, i, s) {
                var r, n, a, o, l, h = 1e-6;
                return null == t ? o = e : "number" == typeof t ? o = t : (r = 360, n = t.split("_"), l = "=" === t.charAt(1), a = (l ? parseInt(t.charAt(0) + "1", 10) * parseFloat(n[0].substr(2)) : parseFloat(n[0])) * (-1 === t.indexOf("rad") ? 1 : F) - (l ? 0 : e), n.length && (s && (s[i] = e + a), -1 !== t.indexOf("short") && (a %= r, a !== a % (r / 2) && (a = 0 > a ? a + r : a - r)), -1 !== t.indexOf("_cw") && 0 > a ? a = (a + 9999999999 * r) % r - (0 | a / r) * r : -1 !== t.indexOf("ccw") && a > 0 && (a = (a - 9999999999 * r) % r - (0 | a / r) * r)), o = e + a), h > o && o > -h && (o = 0), o
            }, oe = {
                aqua: [0, 255, 255],
                lime: [0, 255, 0],
                silver: [192, 192, 192],
                black: [0, 0, 0],
                maroon: [128, 0, 0],
                teal: [0, 128, 128],
                blue: [0, 0, 255],
                navy: [0, 0, 128],
                white: [255, 255, 255],
                fuchsia: [255, 0, 255],
                olive: [128, 128, 0],
                yellow: [255, 255, 0],
                orange: [255, 165, 0],
                gray: [128, 128, 128],
                purple: [128, 0, 128],
                green: [0, 128, 0],
                red: [255, 0, 0],
                pink: [255, 192, 203],
                cyan: [0, 255, 255],
                transparent: [255, 255, 255, 0]
            }, le = function (t, e, i) {
                return t = 0 > t ? t + 1 : t > 1 ? t - 1 : t, 0 | 255 * (1 > 6 * t ? e + 6 * (i - e) * t : .5 > t ? i : 2 > 3 * t ? e + 6 * (i - e) * (2 / 3 - t) : e) + .5
            }, he = a.parseColor = function (t, e) {
                var i, s, r, n, a, o, l, h, _, u, c;
                if (t) if ("number" == typeof t) i = [t >> 16, 255 & t >> 8, 255 & t]; else {
                    if ("," === t.charAt(t.length - 1) && (t = t.substr(0, t.length - 1)), oe[t]) i = oe[t]; else if ("#" === t.charAt(0)) 4 === t.length && (s = t.charAt(1), r = t.charAt(2), n = t.charAt(3), t = "#" + s + s + r + r + n + n), t = parseInt(t.substr(1), 16), i = [t >> 16, 255 & t >> 8, 255 & t]; else if ("hsl" === t.substr(0, 3)) if (i = c = t.match(d), e) {
                        if (-1 !== t.indexOf("=")) return t.match(g)
                    } else a = Number(i[0]) % 360 / 360, o = Number(i[1]) / 100, l = Number(i[2]) / 100, r = .5 >= l ? l * (o + 1) : l + o - l * o, s = 2 * l - r, i.length > 3 && (i[3] = Number(t[3])), i[0] = le(a + 1 / 3, s, r), i[1] = le(a, s, r), i[2] = le(a - 1 / 3, s, r); else i = t.match(d) || oe.transparent;
                    i[0] = Number(i[0]), i[1] = Number(i[1]), i[2] = Number(i[2]), i.length > 3 && (i[3] = Number(i[3]))
                } else i = oe.black;
                return e && !c && (s = i[0] / 255, r = i[1] / 255, n = i[2] / 255, h = Math.max(s, r, n), _ = Math.min(s, r, n), l = (h + _) / 2, h === _ ? a = o = 0 : (u = h - _, o = l > .5 ? u / (2 - h - _) : u / (h + _), a = h === s ? (r - n) / u + (n > r ? 6 : 0) : h === r ? (n - s) / u + 2 : (s - r) / u + 4, a *= 60), i[0] = 0 | a + .5, i[1] = 0 | 100 * o + .5, i[2] = 0 | 100 * l + .5), i
            }, _e = function (t, e) {
                var i, s, r, n = t.match(ue) || [], a = 0, o = n.length ? "" : t;
                for (i = 0; n.length > i; i++) s = n[i], r = t.substr(a, t.indexOf(s, a) - a), a += r.length + s.length, s = he(s, e), 3 === s.length && s.push(1), o += r + (e ? "hsla(" + s[0] + "," + s[1] + "%," + s[2] + "%," + s[3] : "rgba(" + s.join(",")) + ")";
                return o
            }, ue = "(?:\\b(?:(?:rgb|rgba|hsl|hsla)\\(.+?\\))|\\B#.+?\\b";
        for (h in oe) ue += "|" + h + "\\b";
        ue = RegExp(ue + ")", "gi"), a.colorStringFilter = function (t) {
            var e, i = t[0] + t[1];
            ue.lastIndex = 0, ue.test(i) && (e = -1 !== i.indexOf("hsl(") || -1 !== i.indexOf("hsla("), t[0] = _e(t[0], e), t[1] = _e(t[1], e))
        }, e.defaultStringFilter || (e.defaultStringFilter = a.colorStringFilter);
        var ce = function (t, e, i, s) {
            if (null == t) return function (t) {
                return t
            };
            var r, n = e ? (t.match(ue) || [""])[0] : "", a = t.split(n).join("").match(v) || [],
                o = t.substr(0, t.indexOf(a[0])), l = ")" === t.charAt(t.length - 1) ? ")" : "",
                h = -1 !== t.indexOf(" ") ? " " : ",", _ = a.length, u = _ > 0 ? a[0].replace(d, "") : "";
            return _ ? r = e ? function (t) {
                var e, c, f, p;
                if ("number" == typeof t) t += u; else if (s && M.test(t)) {
                    for (p = t.replace(M, "|").split("|"), f = 0; p.length > f; f++) p[f] = r(p[f]);
                    return p.join(",")
                }
                if (e = (t.match(ue) || [n])[0], c = t.split(e).join("").match(v) || [], f = c.length, _ > f--) for (; _ > ++f;) c[f] = i ? c[0 | (f - 1) / 2] : a[f];
                return o + c.join(h) + h + e + l + (-1 !== t.indexOf("inset") ? " inset" : "")
            } : function (t) {
                var e, n, c;
                if ("number" == typeof t) t += u; else if (s && M.test(t)) {
                    for (n = t.replace(M, "|").split("|"), c = 0; n.length > c; c++) n[c] = r(n[c]);
                    return n.join(",")
                }
                if (e = t.match(v) || [], c = e.length, _ > c--) for (; _ > ++c;) e[c] = i ? e[0 | (c - 1) / 2] : a[c];
                return o + e.join(h) + l
            } : function (t) {
                return t
            }
        }, fe = function (t) {
            return t = t.split(","), function (e, i, s, r, n, a, o) {
                var l, h = (i + "").split(" ");
                for (o = {}, l = 0; 4 > l; l++) o[t[l]] = h[l] = h[l] || h[(l - 1) / 2 >> 0];
                return r.parse(e, o, n, a)
            }
        }, pe = (B._setPluginRatio = function (t) {
            this.plugin.setRatio(t);
            for (var e, i, s, r, n = this.data, a = n.proxy, o = n.firstMPT, l = 1e-6; o;) e = a[o.v], o.r ? e = Math.round(e) : l > e && e > -l && (e = 0), o.t[o.p] = e, o = o._next;
            if (n.autoRotate && (n.autoRotate.rotation = a.rotation), 1 === t) for (o = n.firstMPT; o;) {
                if (i = o.t, i.type) {
                    if (1 === i.type) {
                        for (r = i.xs0 + i.s + i.xs1, s = 1; i.l > s; s++) r += i["xn" + s] + i["xs" + (s + 1)];
                        i.e = r
                    }
                } else i.e = i.s + i.xs0;
                o = o._next
            }
        }, function (t, e, i, s, r) {
            this.t = t, this.p = e, this.v = i, this.r = r, s && (s._prev = this, this._next = s)
        }), me = (B._parseToProxy = function (t, e, i, s, r, n) {
            var a, o, l, h, _, u = s, c = {}, f = {}, p = i._transform, m = I;
            for (i._transform = null, I = e, s = _ = i.parse(t, e, s, r), I = m, n && (i._transform = p, u && (u._prev = null, u._prev && (u._prev._next = null))); s && s !== u;) {
                if (1 >= s.type && (o = s.p, f[o] = s.s + s.c, c[o] = s.s, n || (h = new pe(s, "s", o, h, s.r), s.c = 0), 1 === s.type)) for (a = s.l; --a > 0;) l = "xn" + a, o = s.p + "_" + l, f[o] = s.data[l], c[o] = s[l], n || (h = new pe(s, l, o, h, s.rxp[l]));
                s = s._next
            }
            return {proxy: c, end: f, firstMPT: h, pt: _}
        }, B.CSSPropTween = function (t, e, s, r, a, o, l, h, _, u, c) {
            this.t = t, this.p = e, this.s = s, this.c = r, this.n = l || e, t instanceof me || n.push(this.n), this.r = h, this.type = o || 0, _ && (this.pr = _, i = !0), this.b = void 0 === u ? s : u, this.e = void 0 === c ? s + r : c, a && (this._next = a, a._prev = this)
        }), de = function (t, e, i, s, r, n) {
            var a = new me(t, e, i, s - i, r, -1, n);
            return a.b = i, a.e = a.xs0 = s, a
        }, ge = a.parseComplex = function (t, e, i, s, r, n, a, o, l, h) {
            i = i || n || "", a = new me(t, e, 0, 0, a, h ? 2 : 1, null, !1, o, i, s), s += "";
            var u, c, f, p, m, v, y, T, x, w, b, P, k, S = i.split(", ").join(",").split(" "),
                R = s.split(", ").join(",").split(" "), O = S.length, A = _ !== !1;
            for ((-1 !== s.indexOf(",") || -1 !== i.indexOf(",")) && (S = S.join(" ").replace(M, ", ").split(" "), R = R.join(" ").replace(M, ", ").split(" "), O = S.length), O !== R.length && (S = (n || "").split(" "), O = S.length), a.plugin = l, a.setRatio = h, ue.lastIndex = 0, u = 0; O > u; u++) if (p = S[u], m = R[u], T = parseFloat(p), T || 0 === T) a.appendXtra("", T, re(m, T), m.replace(g, ""), A && -1 !== m.indexOf("px"), !0); else if (r && ue.test(p)) P = "," === m.charAt(m.length - 1) ? ")," : ")", k = -1 !== m.indexOf("hsl") && Y, p = he(p, k), m = he(m, k), x = p.length + m.length > 6, x && !Y && 0 === m[3] ? (a["xs" + a.l] += a.l ? " transparent" : "transparent", a.e = a.e.split(R[u]).join("transparent")) : (Y || (x = !1), k ? a.appendXtra(x ? "hsla(" : "hsl(", p[0], re(m[0], p[0]), ",", !1, !0).appendXtra("", p[1], re(m[1], p[1]), "%,", !1).appendXtra("", p[2], re(m[2], p[2]), x ? "%," : "%" + P, !1) : a.appendXtra(x ? "rgba(" : "rgb(", p[0], m[0] - p[0], ",", !0, !0).appendXtra("", p[1], m[1] - p[1], ",", !0).appendXtra("", p[2], m[2] - p[2], x ? "," : P, !0), x && (p = 4 > p.length ? 1 : p[3], a.appendXtra("", p, (4 > m.length ? 1 : m[3]) - p, P, !1))), ue.lastIndex = 0; else if (v = p.match(d)) {
                if (y = m.match(g), !y || y.length !== v.length) return a;
                for (f = 0, c = 0; v.length > c; c++) b = v[c], w = p.indexOf(b, f), a.appendXtra(p.substr(f, w - f), Number(b), re(y[c], b), "", A && "px" === p.substr(w + b.length, 2), 0 === c), f = w + b.length;
                a["xs" + a.l] += p.substr(f)
            } else a["xs" + a.l] += a.l ? " " + p : p;
            if (-1 !== s.indexOf("=") && a.data) {
                for (P = a.xs0 + a.data.s, u = 1; a.l > u; u++) P += a["xs" + u] + a.data["xn" + u];
                a.e = P + a["xs" + u]
            }
            return a.l || (a.type = -1, a.xs0 = a.e), a.xfirst || a
        }, ve = 9;
        for (h = me.prototype, h.l = h.pr = 0; --ve > 0;) h["xn" + ve] = 0, h["xs" + ve] = "";
        h.xs0 = "", h._next = h._prev = h.xfirst = h.data = h.plugin = h.setRatio = h.rxp = null, h.appendXtra = function (t, e, i, s, r, n) {
            var a = this, o = a.l;
            return a["xs" + o] += n && o ? " " + t : t || "", i || 0 === o || a.plugin ? (a.l++, a.type = a.setRatio ? 2 : 1, a["xs" + a.l] = s || "", o > 0 ? (a.data["xn" + o] = e + i, a.rxp["xn" + o] = r, a["xn" + o] = e, a.plugin || (a.xfirst = new me(a, "xn" + o, e, i, a.xfirst || a, 0, a.n, r, a.pr), a.xfirst.xs0 = 0), a) : (a.data = {s: e + i}, a.rxp = {}, a.s = e, a.c = i, a.r = r, a)) : (a["xs" + o] += e + (s || ""), a)
        };
        var ye = function (t, e) {
            e = e || {}, this.p = e.prefix ? W(t) || t : t, l[t] = l[this.p] = this, this.format = e.formatter || ce(e.defaultValue, e.color, e.collapsible, e.multi), e.parser && (this.parse = e.parser), this.clrs = e.color, this.multi = e.multi, this.keyword = e.keyword, this.dflt = e.defaultValue, this.pr = e.priority || 0
        }, Te = B._registerComplexSpecialProp = function (t, e, i) {
            "object" != typeof e && (e = {parser: i});
            var s, r, n = t.split(","), a = e.defaultValue;
            for (i = i || [a], s = 0; n.length > s; s++) e.prefix = 0 === s && e.prefix, e.defaultValue = i[s] || a, r = new ye(n[s], e)
        }, xe = function (t) {
            if (!l[t]) {
                var e = t.charAt(0).toUpperCase() + t.substr(1) + "Plugin";
                Te(t, {
                    parser: function (t, i, s, r, n, a, h) {
                        var _ = o.com.greensock.plugins[e];
                        return _ ? (_._cssRegister(), l[s].parse(t, i, s, r, n, a, h)) : (q("Error: " + e + " js file not loaded."), n)
                    }
                })
            }
        };
        h = ye.prototype, h.parseComplex = function (t, e, i, s, r, n) {
            var a, o, l, h, _, u, c = this.keyword;
            if (this.multi && (M.test(i) || M.test(e) ? (o = e.replace(M, "|").split("|"), l = i.replace(M, "|").split("|")) : c && (o = [e], l = [i])), l) {
                for (h = l.length > o.length ? l.length : o.length, a = 0; h > a; a++) e = o[a] = o[a] || this.dflt, i = l[a] = l[a] || this.dflt, c && (_ = e.indexOf(c), u = i.indexOf(c), _ !== u && (-1 === u ? o[a] = o[a].split(c).join("") : -1 === _ && (o[a] += " " + c)));
                e = o.join(", "), i = l.join(", ")
            }
            return ge(t, this.p, e, i, this.clrs, this.dflt, s, this.pr, r, n)
        }, h.parse = function (t, e, i, s, n, a) {
            return this.parseComplex(t.style, this.format(Q(t, this.p, r, !1, this.dflt)), this.format(e), n, a)
        }, a.registerSpecialProp = function (t, e, i) {
            Te(t, {
                parser: function (t, s, r, n, a, o) {
                    var l = new me(t, r, 0, 0, a, 2, r, !1, i);
                    return l.plugin = o, l.setRatio = e(t, s, n._tween, r), l
                }, priority: i
            })
        }, a.useSVGTransformAttr = c || f;
        var we,
            be = "scaleX,scaleY,scaleZ,x,y,z,skewX,skewY,rotation,rotationX,rotationY,perspective,xPercent,yPercent".split(","),
            Pe = W("transform"), ke = V + "transform", Se = W("transformOrigin"), Re = null !== W("perspective"),
            Oe = B.Transform = function () {
                this.perspective = parseFloat(a.defaultTransformPerspective) || 0, this.force3D = a.defaultForce3D !== !1 && Re ? a.defaultForce3D || "auto" : !1
            }, Ae = window.SVGElement, Ce = function (t, e, i) {
                var s, r = E.createElementNS("http://www.w3.org/2000/svg", t), n = /([a-z])([A-Z])/g;
                for (s in i) r.setAttributeNS(null, s.replace(n, "$1-$2").toLowerCase(), i[s]);
                return e.appendChild(r), r
            }, De = E.documentElement, Me = function () {
                var t, e, i, s = m || /Android/i.test(j) && !window.chrome;
                return E.createElementNS && !s && (t = Ce("svg", De), e = Ce("rect", t, {
                    width: 100,
                    height: 50,
                    x: 100
                }), i = e.getBoundingClientRect().width, e.style[Se] = "50% 50%", e.style[Pe] = "scaleX(0.5)", s = i === e.getBoundingClientRect().width && !(f && Re), De.removeChild(t)), s
            }(), ze = function (t, e, i, s, r) {
                var n, o, l, h, _, u, c, f, p, m, d, g, v, y, T = t._gsTransform, x = Ee(t, !0);
                T && (v = T.xOrigin, y = T.yOrigin), (!s || 2 > (n = s.split(" ")).length) && (c = t.getBBox(), e = se(e).split(" "), n = [(-1 !== e[0].indexOf("%") ? parseFloat(e[0]) / 100 * c.width : parseFloat(e[0])) + c.x, (-1 !== e[1].indexOf("%") ? parseFloat(e[1]) / 100 * c.height : parseFloat(e[1])) + c.y]), i.xOrigin = h = parseFloat(n[0]), i.yOrigin = _ = parseFloat(n[1]), s && x !== Ie && (u = x[0], c = x[1], f = x[2], p = x[3], m = x[4], d = x[5], g = u * p - c * f, o = h * (p / g) + _ * (-f / g) + (f * d - p * m) / g, l = h * (-c / g) + _ * (u / g) - (u * d - c * m) / g, h = i.xOrigin = n[0] = o, _ = i.yOrigin = n[1] = l), T && (r || r !== !1 && a.defaultSmoothOrigin !== !1 ? (o = h - v, l = _ - y, T.xOffset += o * x[0] + l * x[2] - o, T.yOffset += o * x[1] + l * x[3] - l) : T.xOffset = T.yOffset = 0), t.setAttribute("data-svg-origin", n.join(" "))
            }, Fe = function (t) {
                return !!(Ae && "function" == typeof t.getBBox && t.getCTM && (!t.parentNode || t.parentNode.getBBox && t.parentNode.getCTM))
            }, Ie = [1, 0, 0, 1, 0, 0], Ee = function (t, e) {
                var i, s, r, n, a, o = t._gsTransform || new Oe, l = 1e5;
                if (Pe ? s = Q(t, ke, null, !0) : t.currentStyle && (s = t.currentStyle.filter.match(C), s = s && 4 === s.length ? [s[0].substr(4), Number(s[2].substr(4)), Number(s[1].substr(4)), s[3].substr(4), o.x || 0, o.y || 0].join(",") : ""), i = !s || "none" === s || "matrix(1, 0, 0, 1, 0, 0)" === s, (o.svg || t.getBBox && Fe(t)) && (i && -1 !== (t.style[Pe] + "").indexOf("matrix") && (s = t.style[Pe], i = 0), r = t.getAttribute("transform"), i && r && (-1 !== r.indexOf("matrix") ? (s = r, i = 0) : -1 !== r.indexOf("translate") && (s = "matrix(1,0,0,1," + r.match(/(?:\-|\b)[\d\-\.e]+\b/gi).join(",") + ")", i = 0))), i) return Ie;
                for (r = (s || "").match(/(?:\-|\b)[\d\-\.e]+\b/gi) || [], ve = r.length; --ve > -1;) n = Number(r[ve]), r[ve] = (a = n - (n |= 0)) ? (0 | a * l + (0 > a ? -.5 : .5)) / l + n : n;
                return e && r.length > 6 ? [r[0], r[1], r[4], r[5], r[12], r[13]] : r
            }, Ne = B.getTransform = function (t, i, s, n) {
                if (t._gsTransform && s && !n) return t._gsTransform;
                var o, l, h, _, u, c, f = s ? t._gsTransform || new Oe : new Oe, p = 0 > f.scaleX, m = 2e-5, d = 1e5,
                    g = Re ? parseFloat(Q(t, Se, i, !1, "0 0 0").split(" ")[2]) || f.zOrigin || 0 : 0,
                    v = parseFloat(a.defaultTransformPerspective) || 0;
                if (f.svg = !(!t.getBBox || !Fe(t)), f.svg && (ze(t, Q(t, Se, r, !1, "50% 50%") + "", f, t.getAttribute("data-svg-origin")), we = a.useSVGTransformAttr || Me), o = Ee(t), o !== Ie) {
                    if (16 === o.length) {
                        var y, T, x, w, b, P = o[0], k = o[1], S = o[2], R = o[3], O = o[4], A = o[5], C = o[6], D = o[7],
                            M = o[8], z = o[9], I = o[10], E = o[12], N = o[13], L = o[14], X = o[11], B = Math.atan2(C, I);
                        f.zOrigin && (L = -f.zOrigin, E = M * L - o[12], N = z * L - o[13], L = I * L + f.zOrigin - o[14]), f.rotationX = B * F, B && (w = Math.cos(-B), b = Math.sin(-B), y = O * w + M * b, T = A * w + z * b, x = C * w + I * b, M = O * -b + M * w, z = A * -b + z * w, I = C * -b + I * w, X = D * -b + X * w, O = y, A = T, C = x), B = Math.atan2(M, I), f.rotationY = B * F, B && (w = Math.cos(-B), b = Math.sin(-B), y = P * w - M * b, T = k * w - z * b, x = S * w - I * b, z = k * b + z * w, I = S * b + I * w, X = R * b + X * w, P = y, k = T, S = x), B = Math.atan2(k, P), f.rotation = B * F, B && (w = Math.cos(-B), b = Math.sin(-B), P = P * w + O * b, T = k * w + A * b, A = k * -b + A * w, C = S * -b + C * w, k = T), f.rotationX && Math.abs(f.rotationX) + Math.abs(f.rotation) > 359.9 && (f.rotationX = f.rotation = 0, f.rotationY += 180), f.scaleX = (0 | Math.sqrt(P * P + k * k) * d + .5) / d, f.scaleY = (0 | Math.sqrt(A * A + z * z) * d + .5) / d, f.scaleZ = (0 | Math.sqrt(C * C + I * I) * d + .5) / d, f.skewX = 0, f.perspective = X ? 1 / (0 > X ? -X : X) : 0, f.x = E, f.y = N, f.z = L, f.svg && (f.x -= f.xOrigin - (f.xOrigin * P - f.yOrigin * O), f.y -= f.yOrigin - (f.yOrigin * k - f.xOrigin * A))
                    } else if (!(Re && !n && o.length && f.x === o[4] && f.y === o[5] && (f.rotationX || f.rotationY) || void 0 !== f.x && "none" === Q(t, "display", i))) {
                        var j = o.length >= 6, Y = j ? o[0] : 1, U = o[1] || 0, q = o[2] || 0, V = j ? o[3] : 1;
                        f.x = o[4] || 0, f.y = o[5] || 0, h = Math.sqrt(Y * Y + U * U), _ = Math.sqrt(V * V + q * q), u = Y || U ? Math.atan2(U, Y) * F : f.rotation || 0, c = q || V ? Math.atan2(q, V) * F + u : f.skewX || 0, Math.abs(c) > 90 && 270 > Math.abs(c) && (p ? (h *= -1, c += 0 >= u ? 180 : -180, u += 0 >= u ? 180 : -180) : (_ *= -1, c += 0 >= c ? 180 : -180)), f.scaleX = h, f.scaleY = _, f.rotation = u, f.skewX = c, Re && (f.rotationX = f.rotationY = f.z = 0, f.perspective = v, f.scaleZ = 1), f.svg && (f.x -= f.xOrigin - (f.xOrigin * Y + f.yOrigin * q), f.y -= f.yOrigin - (f.xOrigin * U + f.yOrigin * V))
                    }
                    f.zOrigin = g;
                    for (l in f) m > f[l] && f[l] > -m && (f[l] = 0)
                }
                return s && (t._gsTransform = f, f.svg && (we && t.style[Pe] ? e.delayedCall(.001, function () {
                    je(t.style, Pe)
                }) : !we && t.getAttribute("transform") && e.delayedCall(.001, function () {
                    t.removeAttribute("transform")
                }))), f
            }, Le = function (t) {
                var e, i, s = this.data, r = -s.rotation * z, n = r + s.skewX * z, a = 1e5,
                    o = (0 | Math.cos(r) * s.scaleX * a) / a, l = (0 | Math.sin(r) * s.scaleX * a) / a,
                    h = (0 | Math.sin(n) * -s.scaleY * a) / a, _ = (0 | Math.cos(n) * s.scaleY * a) / a, u = this.t.style,
                    c = this.t.currentStyle;
                if (c) {
                    i = l, l = -h, h = -i, e = c.filter, u.filter = "";
                    var f, p, d = this.t.offsetWidth, g = this.t.offsetHeight, v = "absolute" !== c.position,
                        y = "progid:DXImageTransform.Microsoft.Matrix(M11=" + o + ", M12=" + l + ", M21=" + h + ", M22=" + _,
                        w = s.x + d * s.xPercent / 100, b = s.y + g * s.yPercent / 100;
                    if (null != s.ox && (f = (s.oxp ? .01 * d * s.ox : s.ox) - d / 2, p = (s.oyp ? .01 * g * s.oy : s.oy) - g / 2, w += f - (f * o + p * l), b += p - (f * h + p * _)), v ? (f = d / 2, p = g / 2, y += ", Dx=" + (f - (f * o + p * l) + w) + ", Dy=" + (p - (f * h + p * _) + b) + ")") : y += ", sizingMethod='auto expand')", u.filter = -1 !== e.indexOf("DXImageTransform.Microsoft.Matrix(") ? e.replace(D, y) : y + " " + e, (0 === t || 1 === t) && 1 === o && 0 === l && 0 === h && 1 === _ && (v && -1 === y.indexOf("Dx=0, Dy=0") || x.test(e) && 100 !== parseFloat(RegExp.$1) || -1 === e.indexOf("gradient(" && e.indexOf("Alpha")) && u.removeAttribute("filter")), !v) {
                        var P, k, S, R = 8 > m ? 1 : -1;
                        for (f = s.ieOffsetX || 0, p = s.ieOffsetY || 0, s.ieOffsetX = Math.round((d - ((0 > o ? -o : o) * d + (0 > l ? -l : l) * g)) / 2 + w), s.ieOffsetY = Math.round((g - ((0 > _ ? -_ : _) * g + (0 > h ? -h : h) * d)) / 2 + b), ve = 0; 4 > ve; ve++) k = ee[ve], P = c[k], i = -1 !== P.indexOf("px") ? parseFloat(P) : $(this.t, k, parseFloat(P), P.replace(T, "")) || 0, S = i !== s[k] ? 2 > ve ? -s.ieOffsetX : -s.ieOffsetY : 2 > ve ? f - s.ieOffsetX : p - s.ieOffsetY, u[k] = (s[k] = Math.round(i - S * (0 === ve || 2 === ve ? 1 : R))) + "px"
                    }
                }
            }, Xe = B.set3DTransformRatio = B.setTransformRatio = function (t) {
                var e, i, s, r, n, a, o, l, h, _, u, c, p, m, d, g, v, y, T, x, w, b, P, k = this.data, S = this.t.style,
                    R = k.rotation, O = k.rotationX, A = k.rotationY, C = k.scaleX, D = k.scaleY, M = k.scaleZ, F = k.x,
                    I = k.y, E = k.z, N = k.svg, L = k.perspective, X = k.force3D;
                if (!(((1 !== t && 0 !== t || "auto" !== X || this.tween._totalTime !== this.tween._totalDuration && this.tween._totalTime) && X || E || L || A || O) && (!we || !N) && Re)) return R || k.skewX || N ? (R *= z, b = k.skewX * z, P = 1e5, e = Math.cos(R) * C, r = Math.sin(R) * C, i = Math.sin(R - b) * -D, n = Math.cos(R - b) * D, b && "simple" === k.skewType && (v = Math.tan(b), v = Math.sqrt(1 + v * v), i *= v, n *= v, k.skewY && (e *= v, r *= v)), N && (F += k.xOrigin - (k.xOrigin * e + k.yOrigin * i) + k.xOffset, I += k.yOrigin - (k.xOrigin * r + k.yOrigin * n) + k.yOffset, we && (k.xPercent || k.yPercent) && (m = this.t.getBBox(), F += .01 * k.xPercent * m.width, I += .01 * k.yPercent * m.height), m = 1e-6, m > F && F > -m && (F = 0), m > I && I > -m && (I = 0)), T = (0 | e * P) / P + "," + (0 | r * P) / P + "," + (0 | i * P) / P + "," + (0 | n * P) / P + "," + F + "," + I + ")", N && we ? this.t.setAttribute("transform", "matrix(" + T) : S[Pe] = (k.xPercent || k.yPercent ? "translate(" + k.xPercent + "%," + k.yPercent + "%) matrix(" : "matrix(") + T) : S[Pe] = (k.xPercent || k.yPercent ? "translate(" + k.xPercent + "%," + k.yPercent + "%) matrix(" : "matrix(") + C + ",0,0," + D + "," + F + "," + I + ")", void 0;
                if (f && (m = 1e-4, m > C && C > -m && (C = M = 2e-5), m > D && D > -m && (D = M = 2e-5), !L || k.z || k.rotationX || k.rotationY || (L = 0)), R || k.skewX) R *= z, d = e = Math.cos(R), g = r = Math.sin(R), k.skewX && (R -= k.skewX * z, d = Math.cos(R), g = Math.sin(R), "simple" === k.skewType && (v = Math.tan(k.skewX * z), v = Math.sqrt(1 + v * v), d *= v, g *= v, k.skewY && (e *= v, r *= v))), i = -g, n = d; else {
                    if (!(A || O || 1 !== M || L || N)) return S[Pe] = (k.xPercent || k.yPercent ? "translate(" + k.xPercent + "%," + k.yPercent + "%) translate3d(" : "translate3d(") + F + "px," + I + "px," + E + "px)" + (1 !== C || 1 !== D ? " scale(" + C + "," + D + ")" : ""), void 0;
                    e = n = 1, i = r = 0
                }
                h = 1, s = a = o = l = _ = u = 0, c = L ? -1 / L : 0, p = k.zOrigin, m = 1e-6, x = ",", w = "0", R = A * z, R && (d = Math.cos(R), g = Math.sin(R), o = -g, _ = c * -g, s = e * g, a = r * g, h = d, c *= d, e *= d, r *= d), R = O * z, R && (d = Math.cos(R), g = Math.sin(R), v = i * d + s * g, y = n * d + a * g, l = h * g, u = c * g, s = i * -g + s * d, a = n * -g + a * d, h *= d, c *= d, i = v, n = y), 1 !== M && (s *= M, a *= M, h *= M, c *= M), 1 !== D && (i *= D, n *= D, l *= D, u *= D), 1 !== C && (e *= C, r *= C, o *= C, _ *= C), (p || N) && (p && (F += s * -p, I += a * -p, E += h * -p + p), N && (F += k.xOrigin - (k.xOrigin * e + k.yOrigin * i) + k.xOffset, I += k.yOrigin - (k.xOrigin * r + k.yOrigin * n) + k.yOffset), m > F && F > -m && (F = w), m > I && I > -m && (I = w), m > E && E > -m && (E = 0)), T = k.xPercent || k.yPercent ? "translate(" + k.xPercent + "%," + k.yPercent + "%) matrix3d(" : "matrix3d(", T += (m > e && e > -m ? w : e) + x + (m > r && r > -m ? w : r) + x + (m > o && o > -m ? w : o), T += x + (m > _ && _ > -m ? w : _) + x + (m > i && i > -m ? w : i) + x + (m > n && n > -m ? w : n), O || A ? (T += x + (m > l && l > -m ? w : l) + x + (m > u && u > -m ? w : u) + x + (m > s && s > -m ? w : s), T += x + (m > a && a > -m ? w : a) + x + (m > h && h > -m ? w : h) + x + (m > c && c > -m ? w : c) + x) : T += ",0,0,0,0,1,0,", T += F + x + I + x + E + x + (L ? 1 + -E / L : 1) + ")", S[Pe] = T
            };
        h = Oe.prototype, h.x = h.y = h.z = h.skewX = h.skewY = h.rotation = h.rotationX = h.rotationY = h.zOrigin = h.xPercent = h.yPercent = h.xOffset = h.yOffset = 0, h.scaleX = h.scaleY = h.scaleZ = 1, Te("transform,scale,scaleX,scaleY,scaleZ,x,y,z,rotation,rotationX,rotationY,rotationZ,skewX,skewY,shortRotation,shortRotationX,shortRotationY,shortRotationZ,transformOrigin,svgOrigin,transformPerspective,directionalRotation,parseTransform,force3D,skewType,xPercent,yPercent,smoothOrigin", {
            parser: function (t, e, i, s, n, o, l) {
                if (s._lastParsedTransform === l) return n;
                s._lastParsedTransform = l;
                var h, _, u, c, f, p, m, d, g, v, y = t._gsTransform, T = t.style, x = 1e-6, w = be.length, b = l,
                    P = {}, k = "transformOrigin";
                if (l.display ? (c = Q(t, "display"), T.display = "block", h = Ne(t, r, !0, l.parseTransform), T.display = c) : h = Ne(t, r, !0, l.parseTransform), s._transform = h, "string" == typeof b.transform && Pe) c = L.style, c[Pe] = b.transform, c.display = "block", c.position = "absolute", E.body.appendChild(L), _ = Ne(L, null, !1), E.body.removeChild(L), _.perspective || (_.perspective = h.perspective), null != b.xPercent && (_.xPercent = ne(b.xPercent, h.xPercent)), null != b.yPercent && (_.yPercent = ne(b.yPercent, h.yPercent)); else if ("object" == typeof b) {
                    if (_ = {
                        scaleX: ne(null != b.scaleX ? b.scaleX : b.scale, h.scaleX),
                        scaleY: ne(null != b.scaleY ? b.scaleY : b.scale, h.scaleY),
                        scaleZ: ne(b.scaleZ, h.scaleZ),
                        x: ne(b.x, h.x),
                        y: ne(b.y, h.y),
                        z: ne(b.z, h.z),
                        xPercent: ne(b.xPercent, h.xPercent),
                        yPercent: ne(b.yPercent, h.yPercent),
                        perspective: ne(b.transformPerspective, h.perspective)
                    }, d = b.directionalRotation, null != d) if ("object" == typeof d) for (c in d) b[c] = d[c]; else b.rotation = d;
                    "string" == typeof b.x && -1 !== b.x.indexOf("%") && (_.x = 0, _.xPercent = ne(b.x, h.xPercent)), "string" == typeof b.y && -1 !== b.y.indexOf("%") && (_.y = 0, _.yPercent = ne(b.y, h.yPercent)), _.rotation = ae("rotation" in b ? b.rotation : "shortRotation" in b ? b.shortRotation + "_short" : "rotationZ" in b ? b.rotationZ : h.rotation, h.rotation, "rotation", P), Re && (_.rotationX = ae("rotationX" in b ? b.rotationX : "shortRotationX" in b ? b.shortRotationX + "_short" : h.rotationX || 0, h.rotationX, "rotationX", P), _.rotationY = ae("rotationY" in b ? b.rotationY : "shortRotationY" in b ? b.shortRotationY + "_short" : h.rotationY || 0, h.rotationY, "rotationY", P)), _.skewX = null == b.skewX ? h.skewX : ae(b.skewX, h.skewX), _.skewY = null == b.skewY ? h.skewY : ae(b.skewY, h.skewY), (u = _.skewY - h.skewY) && (_.skewX += u, _.rotation += u)
                }
                for (Re && null != b.force3D && (h.force3D = b.force3D, m = !0), h.skewType = b.skewType || h.skewType || a.defaultSkewType, p = h.force3D || h.z || h.rotationX || h.rotationY || _.z || _.rotationX || _.rotationY || _.perspective, p || null == b.scale || (_.scaleZ = 1); --w > -1;) i = be[w], f = _[i] - h[i], (f > x || -x > f || null != b[i] || null != I[i]) && (m = !0, n = new me(h, i, h[i], f, n), i in P && (n.e = P[i]), n.xs0 = 0, n.plugin = o, s._overwriteProps.push(n.n));
                return f = b.transformOrigin, h.svg && (f || b.svgOrigin) && (g = h.xOffset, v = h.yOffset, ze(t, se(f), _, b.svgOrigin, b.smoothOrigin), n = de(h, "xOrigin", (y ? h : _).xOrigin, _.xOrigin, n, k), n = de(h, "yOrigin", (y ? h : _).yOrigin, _.yOrigin, n, k), (g !== h.xOffset || v !== h.yOffset) && (n = de(h, "xOffset", y ? g : h.xOffset, h.xOffset, n, k), n = de(h, "yOffset", y ? v : h.yOffset, h.yOffset, n, k)), f = we ? null : "0px 0px"), (f || Re && p && h.zOrigin) && (Pe ? (m = !0, i = Se, f = (f || Q(t, i, r, !1, "50% 50%")) + "", n = new me(T, i, 0, 0, n, -1, k), n.b = T[i], n.plugin = o, Re ? (c = h.zOrigin, f = f.split(" "), h.zOrigin = (f.length > 2 && (0 === c || "0px" !== f[2]) ? parseFloat(f[2]) : c) || 0, n.xs0 = n.e = f[0] + " " + (f[1] || "50%") + " 0px", n = new me(h, "zOrigin", 0, 0, n, -1, n.n), n.b = c, n.xs0 = n.e = h.zOrigin) : n.xs0 = n.e = f) : se(f + "", h)), m && (s._transformType = h.svg && we || !p && 3 !== this._transformType ? 2 : 3), n
            }, prefix: !0
        }), Te("boxShadow", {
            defaultValue: "0px 0px 0px 0px #999",
            prefix: !0,
            color: !0,
            multi: !0,
            keyword: "inset"
        }), Te("borderRadius", {
            defaultValue: "0px", parser: function (t, e, i, n, a) {
                e = this.format(e);
                var o, l, h, _, u, c, f, p, m, d, g, v, y, T, x, w,
                    b = ["borderTopLeftRadius", "borderTopRightRadius", "borderBottomRightRadius", "borderBottomLeftRadius"],
                    P = t.style;
                for (m = parseFloat(t.offsetWidth), d = parseFloat(t.offsetHeight), o = e.split(" "), l = 0; b.length > l; l++) this.p.indexOf("border") && (b[l] = W(b[l])), u = _ = Q(t, b[l], r, !1, "0px"), -1 !== u.indexOf(" ") && (_ = u.split(" "), u = _[0], _ = _[1]), c = h = o[l], f = parseFloat(u), v = u.substr((f + "").length), y = "=" === c.charAt(1), y ? (p = parseInt(c.charAt(0) + "1", 10), c = c.substr(2), p *= parseFloat(c), g = c.substr((p + "").length - (0 > p ? 1 : 0)) || "") : (p = parseFloat(c), g = c.substr((p + "").length)), "" === g && (g = s[i] || v), g !== v && (T = $(t, "borderLeft", f, v), x = $(t, "borderTop", f, v), "%" === g ? (u = 100 * (T / m) + "%", _ = 100 * (x / d) + "%") : "em" === g ? (w = $(t, "borderLeft", 1, "em"), u = T / w + "em", _ = x / w + "em") : (u = T + "px", _ = x + "px"), y && (c = parseFloat(u) + p + g, h = parseFloat(_) + p + g)), a = ge(P, b[l], u + " " + _, c + " " + h, !1, "0px", a);
                return a
            }, prefix: !0, formatter: ce("0px 0px 0px 0px", !1, !0)
        }), Te("backgroundPosition", {
            defaultValue: "0 0", parser: function (t, e, i, s, n, a) {
                var o, l, h, _, u, c, f = "background-position", p = r || Z(t, null),
                    d = this.format((p ? m ? p.getPropertyValue(f + "-x") + " " + p.getPropertyValue(f + "-y") : p.getPropertyValue(f) : t.currentStyle.backgroundPositionX + " " + t.currentStyle.backgroundPositionY) || "0 0"),
                    g = this.format(e);
                if (-1 !== d.indexOf("%") != (-1 !== g.indexOf("%")) && (c = Q(t, "backgroundImage").replace(R, ""), c && "none" !== c)) {
                    for (o = d.split(" "), l = g.split(" "), X.setAttribute("src", c), h = 2; --h > -1;) d = o[h], _ = -1 !== d.indexOf("%"), _ !== (-1 !== l[h].indexOf("%")) && (u = 0 === h ? t.offsetWidth - X.width : t.offsetHeight - X.height, o[h] = _ ? parseFloat(d) / 100 * u + "px" : 100 * (parseFloat(d) / u) + "%");
                    d = o.join(" ")
                }
                return this.parseComplex(t.style, d, g, n, a)
            }, formatter: se
        }), Te("backgroundSize", {defaultValue: "0 0", formatter: se}), Te("perspective", {
            defaultValue: "0px",
            prefix: !0
        }), Te("perspectiveOrigin", {
            defaultValue: "50% 50%",
            prefix: !0
        }), Te("transformStyle", {prefix: !0}), Te("backfaceVisibility", {prefix: !0}), Te("userSelect", {prefix: !0}), Te("margin", {parser: fe("marginTop,marginRight,marginBottom,marginLeft")}), Te("padding", {parser: fe("paddingTop,paddingRight,paddingBottom,paddingLeft")}), Te("clip", {
            defaultValue: "rect(0px,0px,0px,0px)",
            parser: function (t, e, i, s, n, a) {
                var o, l, h;
                return 9 > m ? (l = t.currentStyle, h = 8 > m ? " " : ",", o = "rect(" + l.clipTop + h + l.clipRight + h + l.clipBottom + h + l.clipLeft + ")", e = this.format(e).split(",").join(h)) : (o = this.format(Q(t, this.p, r, !1, this.dflt)), e = this.format(e)), this.parseComplex(t.style, o, e, n, a)
            }
        }), Te("textShadow", {
            defaultValue: "0px 0px 0px #999",
            color: !0,
            multi: !0
        }), Te("autoRound,strictUnits", {
            parser: function (t, e, i, s, r) {
                return r
            }
        }), Te("border", {
            defaultValue: "0px solid #000", parser: function (t, e, i, s, n, a) {
                return this.parseComplex(t.style, this.format(Q(t, "borderTopWidth", r, !1, "0px") + " " + Q(t, "borderTopStyle", r, !1, "solid") + " " + Q(t, "borderTopColor", r, !1, "#000")), this.format(e), n, a)
            }, color: !0, formatter: function (t) {
                var e = t.split(" ");
                return e[0] + " " + (e[1] || "solid") + " " + (t.match(ue) || ["#000"])[0]
            }
        }), Te("borderWidth", {parser: fe("borderTopWidth,borderRightWidth,borderBottomWidth,borderLeftWidth")}), Te("float,cssFloat,styleFloat", {
            parser: function (t, e, i, s, r) {
                var n = t.style, a = "cssFloat" in n ? "cssFloat" : "styleFloat";
                return new me(n, a, 0, 0, r, -1, i, !1, 0, n[a], e)
            }
        });
        var Be = function (t) {
            var e, i = this.t, s = i.filter || Q(this.data, "filter") || "", r = 0 | this.s + this.c * t;
            100 === r && (-1 === s.indexOf("atrix(") && -1 === s.indexOf("radient(") && -1 === s.indexOf("oader(") ? (i.removeAttribute("filter"), e = !Q(this.data, "filter")) : (i.filter = s.replace(b, ""), e = !0)), e || (this.xn1 && (i.filter = s = s || "alpha(opacity=" + r + ")"), -1 === s.indexOf("pacity") ? 0 === r && this.xn1 || (i.filter = s + " alpha(opacity=" + r + ")") : i.filter = s.replace(x, "opacity=" + r))
        };
        Te("opacity,alpha,autoAlpha", {
            defaultValue: "1", parser: function (t, e, i, s, n, a) {
                var o = parseFloat(Q(t, "opacity", r, !1, "1")), l = t.style, h = "autoAlpha" === i;
                return "string" == typeof e && "=" === e.charAt(1) && (e = ("-" === e.charAt(0) ? -1 : 1) * parseFloat(e.substr(2)) + o), h && 1 === o && "hidden" === Q(t, "visibility", r) && 0 !== e && (o = 0), Y ? n = new me(l, "opacity", o, e - o, n) : (n = new me(l, "opacity", 100 * o, 100 * (e - o), n), n.xn1 = h ? 1 : 0, l.zoom = 1, n.type = 2, n.b = "alpha(opacity=" + n.s + ")", n.e = "alpha(opacity=" + (n.s + n.c) + ")", n.data = t, n.plugin = a, n.setRatio = Be), h && (n = new me(l, "visibility", 0, 0, n, -1, null, !1, 0, 0 !== o ? "inherit" : "hidden", 0 === e ? "hidden" : "inherit"), n.xs0 = "inherit", s._overwriteProps.push(n.n), s._overwriteProps.push(i)), n
            }
        });
        var je = function (t, e) {
            e && (t.removeProperty ? (("ms" === e.substr(0, 2) || "webkit" === e.substr(0, 6)) && (e = "-" + e), t.removeProperty(e.replace(k, "-$1").toLowerCase())) : t.removeAttribute(e))
        }, Ye = function (t) {
            if (this.t._gsClassPT = this, 1 === t || 0 === t) {
                this.t.setAttribute("class", 0 === t ? this.b : this.e);
                for (var e = this.data, i = this.t.style; e;) e.v ? i[e.p] = e.v : je(i, e.p), e = e._next;
                1 === t && this.t._gsClassPT === this && (this.t._gsClassPT = null)
            } else this.t.getAttribute("class") !== this.e && this.t.setAttribute("class", this.e)
        };
        Te("className", {
            parser: function (t, e, s, n, a, o, l) {
                var h, _, u, c, f, p = t.getAttribute("class") || "", m = t.style.cssText;
                if (a = n._classNamePT = new me(t, s, 0, 0, a, 2), a.setRatio = Ye, a.pr = -11, i = !0, a.b = p, _ = K(t, r), u = t._gsClassPT) {
                    for (c = {}, f = u.data; f;) c[f.p] = 1, f = f._next;
                    u.setRatio(1)
                }
                return t._gsClassPT = a, a.e = "=" !== e.charAt(1) ? e : p.replace(RegExp("\\s*\\b" + e.substr(2) + "\\b"), "") + ("+" === e.charAt(0) ? " " + e.substr(2) : ""), t.setAttribute("class", a.e), h = J(t, _, K(t), l, c), t.setAttribute("class", p), a.data = h.firstMPT, t.style.cssText = m, a = a.xfirst = n.parse(t, h.difs, a, o)
            }
        });
        var Ue = function (t) {
            if ((1 === t || 0 === t) && this.data._totalTime === this.data._totalDuration && "isFromStart" !== this.data.data) {
                var e, i, s, r, n, a = this.t.style, o = l.transform.parse;
                if ("all" === this.e) a.cssText = "", r = !0; else for (e = this.e.split(" ").join("").split(","), s = e.length; --s > -1;) i = e[s], l[i] && (l[i].parse === o ? r = !0 : i = "transformOrigin" === i ? Se : l[i].p), je(a, i);
                r && (je(a, Pe), n = this.t._gsTransform, n && (n.svg && this.t.removeAttribute("data-svg-origin"), delete this.t._gsTransform))
            }
        };
        for (Te("clearProps", {
            parser: function (t, e, s, r, n) {
                return n = new me(t, s, 0, 0, n, 2), n.setRatio = Ue, n.e = e, n.pr = -10, n.data = r._tween, i = !0, n
            }
        }), h = "bezier,throwProps,physicsProps,physics2D".split(","), ve = h.length; ve--;) xe(h[ve]);
        h = a.prototype, h._firstPT = h._lastParsedTransform = h._transform = null, h._onInitTween = function (t, e, o) {
            if (!t.nodeType) return !1;
            this._target = t, this._tween = o, this._vars = e, _ = e.autoRound, i = !1, s = e.suffixMap || a.suffixMap, r = Z(t, ""), n = this._overwriteProps;
            var h, f, m, d, g, v, y, T, x, b = t.style;
            if (u && "" === b.zIndex && (h = Q(t, "zIndex", r), ("auto" === h || "" === h) && this._addLazySet(b, "zIndex", 0)), "string" == typeof e && (d = b.cssText, h = K(t, r), b.cssText = d + ";" + e, h = J(t, h, K(t)).difs, !Y && w.test(e) && (h.opacity = parseFloat(RegExp.$1)), e = h, b.cssText = d), this._firstPT = f = e.className ? l.className.parse(t, e.className, "className", this, null, null, e) : this.parse(t, e, null), this._transformType) {
                for (x = 3 === this._transformType, Pe ? c && (u = !0, "" === b.zIndex && (y = Q(t, "zIndex", r), ("auto" === y || "" === y) && this._addLazySet(b, "zIndex", 0)), p && this._addLazySet(b, "WebkitBackfaceVisibility", this._vars.WebkitBackfaceVisibility || (x ? "visible" : "hidden"))) : b.zoom = 1, m = f; m && m._next;) m = m._next;
                T = new me(t, "transform", 0, 0, null, 2), this._linkCSSP(T, null, m), T.setRatio = Pe ? Xe : Le, T.data = this._transform || Ne(t, r, !0), T.tween = o, T.pr = -1, n.pop()
            }
            if (i) {
                for (; f;) {
                    for (v = f._next, m = d; m && m.pr > f.pr;) m = m._next;
                    (f._prev = m ? m._prev : g) ? f._prev._next = f : d = f, (f._next = m) ? m._prev = f : g = f, f = v
                }
                this._firstPT = d
            }
            return !0
        }, h.parse = function (t, e, i, n) {
            var a, o, h, u, c, f, p, m, d, g, v = t.style;
            for (a in e) f = e[a], o = l[a], o ? i = o.parse(t, f, a, this, i, n, e) : (c = Q(t, a, r) + "", d = "string" == typeof f, "color" === a || "fill" === a || "stroke" === a || -1 !== a.indexOf("Color") || d && P.test(f) ? (d || (f = he(f), f = (f.length > 3 ? "rgba(" : "rgb(") + f.join(",") + ")"), i = ge(v, a, c, f, !0, "transparent", i, 0, n)) : !d || -1 === f.indexOf(" ") && -1 === f.indexOf(",") ? (h = parseFloat(c), p = h || 0 === h ? c.substr((h + "").length) : "", ("" === c || "auto" === c) && ("width" === a || "height" === a ? (h = ie(t, a, r), p = "px") : "left" === a || "top" === a ? (h = H(t, a, r), p = "px") : (h = "opacity" !== a ? 0 : 1, p = "")), g = d && "=" === f.charAt(1), g ? (u = parseInt(f.charAt(0) + "1", 10), f = f.substr(2), u *= parseFloat(f), m = f.replace(T, "")) : (u = parseFloat(f), m = d ? f.replace(T, "") : ""), "" === m && (m = a in s ? s[a] : p), f = u || 0 === u ? (g ? u + h : u) + m : e[a], p !== m && "" !== m && (u || 0 === u) && h && (h = $(t, a, h, p), "%" === m ? (h /= $(t, a, 100, "%") / 100, e.strictUnits !== !0 && (c = h + "%")) : "em" === m || "rem" === m ? h /= $(t, a, 1, m) : "px" !== m && (u = $(t, a, u, m), m = "px"), g && (u || 0 === u) && (f = u + h + m)), g && (u += h), !h && 0 !== h || !u && 0 !== u ? void 0 !== v[a] && (f || "NaN" != f + "" && null != f) ? (i = new me(v, a, u || h || 0, 0, i, -1, a, !1, 0, c, f), i.xs0 = "none" !== f || "display" !== a && -1 === a.indexOf("Style") ? f : c) : q("invalid " + a + " tween value: " + e[a]) : (i = new me(v, a, h, u - h, i, 0, a, _ !== !1 && ("px" === m || "zIndex" === a), 0, c, f), i.xs0 = m)) : i = ge(v, a, c, f, !0, null, i, 0, n)), n && i && !i.plugin && (i.plugin = n);
            return i
        }, h.setRatio = function (t) {
            var e, i, s, r = this._firstPT, n = 1e-6;
            if (1 !== t || this._tween._time !== this._tween._duration && 0 !== this._tween._time) if (t || this._tween._time !== this._tween._duration && 0 !== this._tween._time || this._tween._rawPrevTime === -1e-6) for (; r;) {
                if (e = r.c * t + r.s, r.r ? e = Math.round(e) : n > e && e > -n && (e = 0), r.type) if (1 === r.type) if (s = r.l, 2 === s) r.t[r.p] = r.xs0 + e + r.xs1 + r.xn1 + r.xs2; else if (3 === s) r.t[r.p] = r.xs0 + e + r.xs1 + r.xn1 + r.xs2 + r.xn2 + r.xs3; else if (4 === s) r.t[r.p] = r.xs0 + e + r.xs1 + r.xn1 + r.xs2 + r.xn2 + r.xs3 + r.xn3 + r.xs4; else if (5 === s) r.t[r.p] = r.xs0 + e + r.xs1 + r.xn1 + r.xs2 + r.xn2 + r.xs3 + r.xn3 + r.xs4 + r.xn4 + r.xs5; else {
                    for (i = r.xs0 + e + r.xs1, s = 1; r.l > s; s++) i += r["xn" + s] + r["xs" + (s + 1)];
                    r.t[r.p] = i
                } else -1 === r.type ? r.t[r.p] = r.xs0 : r.setRatio && r.setRatio(t); else r.t[r.p] = e + r.xs0;
                r = r._next
            } else for (; r;) 2 !== r.type ? r.t[r.p] = r.b : r.setRatio(t), r = r._next; else for (; r;) {
                if (2 !== r.type) if (r.r && -1 !== r.type) if (e = Math.round(r.s + r.c), r.type) {
                    if (1 === r.type) {
                        for (s = r.l, i = r.xs0 + e + r.xs1, s = 1; r.l > s; s++) i += r["xn" + s] + r["xs" + (s + 1)];
                        r.t[r.p] = i
                    }
                } else r.t[r.p] = e + r.xs0; else r.t[r.p] = r.e; else r.setRatio(t);
                r = r._next
            }
        }, h._enableTransforms = function (t) {
            this._transform = this._transform || Ne(this._target, r, !0), this._transformType = this._transform.svg && we || !t && 3 !== this._transformType ? 2 : 3
        };
        var qe = function () {
            this.t[this.p] = this.e, this.data._linkCSSP(this, this._next, null, !0)
        };
        h._addLazySet = function (t, e, i) {
            var s = this._firstPT = new me(t, e, 0, 0, this._firstPT, 2);
            s.e = i, s.setRatio = qe, s.data = this
        }, h._linkCSSP = function (t, e, i, s) {
            return t && (e && (e._prev = t), t._next && (t._next._prev = t._prev), t._prev ? t._prev._next = t._next : this._firstPT === t && (this._firstPT = t._next, s = !0), i ? i._next = t : s || null !== this._firstPT || (this._firstPT = t), t._next = e, t._prev = i), t
        }, h._kill = function (e) {
            var i, s, r, n = e;
            if (e.autoAlpha || e.alpha) {
                n = {};
                for (s in e) n[s] = e[s];
                n.opacity = 1, n.autoAlpha && (n.visibility = 1)
            }
            return e.className && (i = this._classNamePT) && (r = i.xfirst, r && r._prev ? this._linkCSSP(r._prev, i._next, r._prev._prev) : r === this._firstPT && (this._firstPT = i._next), i._next && this._linkCSSP(i._next, i._next._next, r._prev), this._classNamePT = null), t.prototype._kill.call(this, n)
        };
        var Ve = function (t, e, i) {
            var s, r, n, a;
            if (t.slice) for (r = t.length; --r > -1;) Ve(t[r], e, i); else for (s = t.childNodes, r = s.length; --r > -1;) n = s[r], a = n.type, n.style && (e.push(K(n)), i && i.push(n)), 1 !== a && 9 !== a && 11 !== a || !n.childNodes.length || Ve(n, e, i)
        };
        return a.cascadeTo = function (t, i, s) {
            var r, n, a, o, l = e.to(t, i, s), h = [l], _ = [], u = [], c = [], f = e._internals.reservedProps;
            for (t = l._targets || l.target, Ve(t, _, c), l.render(i, !0, !0), Ve(t, u), l.render(0, !0, !0), l._enabled(!0), r = c.length; --r > -1;) if (n = J(c[r], _[r], u[r]), n.firstMPT) {
                n = n.difs;
                for (a in s) f[a] && (n[a] = s[a]);
                o = {};
                for (a in n) o[a] = _[r][a];
                h.push(e.fromTo(c[r], i, o, n))
            }
            return h
        }, t.activate([a]), a
    }, !0), function () {
        var t = _gsScope._gsDefine.plugin({
            propName: "roundProps",
            version: "1.5",
            priority: -1,
            API: 2,
            init: function (t, e, i) {
                return this._tween = i, !0
            }
        }), e = function (t) {
            for (; t;) t.f || t.blob || (t.r = 1), t = t._next
        }, i = t.prototype;
        i._onInitAllProps = function () {
            for (var t, i, s, r = this._tween, n = r.vars.roundProps.join ? r.vars.roundProps : r.vars.roundProps.split(","), a = n.length, o = {}, l = r._propLookup.roundProps; --a > -1;) o[n[a]] = 1;
            for (a = n.length; --a > -1;) for (t = n[a], i = r._firstPT; i;) s = i._next, i.pg ? i.t._roundProps(o, !0) : i.n === t && (2 === i.f && i.t ? e(i.t._firstPT) : (this._add(i.t, t, i.s, i.c), s && (s._prev = i._prev), i._prev ? i._prev._next = s : r._firstPT === i && (r._firstPT = s), i._next = i._prev = null, r._propLookup[t] = l)), i = s;
            return !1
        }, i._add = function (t, e, i, s) {
            this._addTween(t, e, i, i + s, e, !0), this._overwriteProps.push(e)
        }
    }(), function () {
        _gsScope._gsDefine.plugin({
            propName: "attr", API: 2, version: "0.5.0", init: function (t, e) {
                var i;
                if ("function" != typeof t.setAttribute) return !1;
                for (i in e) this._addTween(t, "setAttribute", t.getAttribute(i) + "", e[i] + "", i, !1, i), this._overwriteProps.push(i);
                return !0
            }
        })
    }(), _gsScope._gsDefine.plugin({
        propName: "directionalRotation", version: "0.2.1", API: 2, init: function (t, e) {
            "object" != typeof e && (e = {rotation: e}), this.finals = {};
            var i, s, r, n, a, o, l = e.useRadians === !0 ? 2 * Math.PI : 360, h = 1e-6;
            for (i in e) "useRadians" !== i && (o = (e[i] + "").split("_"), s = o[0], r = parseFloat("function" != typeof t[i] ? t[i] : t[i.indexOf("set") || "function" != typeof t["get" + i.substr(3)] ? i : "get" + i.substr(3)]()), n = this.finals[i] = "string" == typeof s && "=" === s.charAt(1) ? r + parseInt(s.charAt(0) + "1", 10) * Number(s.substr(2)) : Number(s) || 0, a = n - r, o.length && (s = o.join("_"), -1 !== s.indexOf("short") && (a %= l, a !== a % (l / 2) && (a = 0 > a ? a + l : a - l)), -1 !== s.indexOf("_cw") && 0 > a ? a = (a + 9999999999 * l) % l - (0 | a / l) * l : -1 !== s.indexOf("ccw") && a > 0 && (a = (a - 9999999999 * l) % l - (0 | a / l) * l)), (a > h || -h > a) && (this._addTween(t, i, r, r + a, i), this._overwriteProps.push(i)));
            return !0
        }, set: function (t) {
            var e;
            if (1 !== t) this._super.setRatio.call(this, t); else for (e = this._firstPT; e;) e.f ? e.t[e.p](this.finals[e.p]) : e.t[e.p] = this.finals[e.p], e = e._next
        }
    })._autoCSS = !0, _gsScope._gsDefine("easing.Back", ["easing.Ease"], function (t) {
        var e, i, s, r = _gsScope.GreenSockGlobals || _gsScope, n = r.com.greensock, a = 2 * Math.PI, o = Math.PI / 2,
            l = n._class, h = function (e, i) {
                var s = l("easing." + e, function () {
                }, !0), r = s.prototype = new t;
                return r.constructor = s, r.getRatio = i, s
            }, _ = t.register || function () {
            }, u = function (t, e, i, s) {
                var r = l("easing." + t, {easeOut: new e, easeIn: new i, easeInOut: new s}, !0);
                return _(r, t), r
            }, c = function (t, e, i) {
                this.t = t, this.v = e, i && (this.next = i, i.prev = this, this.c = i.v - e, this.gap = i.t - t)
            }, f = function (e, i) {
                var s = l("easing." + e, function (t) {
                    this._p1 = t || 0 === t ? t : 1.70158, this._p2 = 1.525 * this._p1
                }, !0), r = s.prototype = new t;
                return r.constructor = s, r.getRatio = i, r.config = function (t) {
                    return new s(t)
                }, s
            }, p = u("Back", f("BackOut", function (t) {
                return (t -= 1) * t * ((this._p1 + 1) * t + this._p1) + 1
            }), f("BackIn", function (t) {
                return t * t * ((this._p1 + 1) * t - this._p1)
            }), f("BackInOut", function (t) {
                return 1 > (t *= 2) ? .5 * t * t * ((this._p2 + 1) * t - this._p2) : .5 * ((t -= 2) * t * ((this._p2 + 1) * t + this._p2) + 2)
            })), m = l("easing.SlowMo", function (t, e, i) {
                e = e || 0 === e ? e : .7, null == t ? t = .7 : t > 1 && (t = 1), this._p = 1 !== t ? e : 0, this._p1 = (1 - t) / 2, this._p2 = t, this._p3 = this._p1 + this._p2, this._calcEnd = i === !0
            }, !0), d = m.prototype = new t;
        return d.constructor = m, d.getRatio = function (t) {
            var e = t + (.5 - t) * this._p;
            return this._p1 > t ? this._calcEnd ? 1 - (t = 1 - t / this._p1) * t : e - (t = 1 - t / this._p1) * t * t * t * e : t > this._p3 ? this._calcEnd ? 1 - (t = (t - this._p3) / this._p1) * t : e + (t - e) * (t = (t - this._p3) / this._p1) * t * t * t : this._calcEnd ? 1 : e
        }, m.ease = new m(.7, .7), d.config = m.config = function (t, e, i) {
            return new m(t, e, i)
        }, e = l("easing.SteppedEase", function (t) {
            t = t || 1, this._p1 = 1 / t, this._p2 = t + 1
        }, !0), d = e.prototype = new t, d.constructor = e, d.getRatio = function (t) {
            return 0 > t ? t = 0 : t >= 1 && (t = .999999999), (this._p2 * t >> 0) * this._p1
        }, d.config = e.config = function (t) {
            return new e(t)
        }, i = l("easing.RoughEase", function (e) {
            e = e || {};
            for (var i, s, r, n, a, o, l = e.taper || "none", h = [], _ = 0, u = 0 | (e.points || 20), f = u, p = e.randomize !== !1, m = e.clamp === !0, d = e.template instanceof t ? e.template : null, g = "number" == typeof e.strength ? .4 * e.strength : .4; --f > -1;) i = p ? Math.random() : 1 / u * f, s = d ? d.getRatio(i) : i, "none" === l ? r = g : "out" === l ? (n = 1 - i, r = n * n * g) : "in" === l ? r = i * i * g : .5 > i ? (n = 2 * i, r = .5 * n * n * g) : (n = 2 * (1 - i), r = .5 * n * n * g), p ? s += Math.random() * r - .5 * r : f % 2 ? s += .5 * r : s -= .5 * r, m && (s > 1 ? s = 1 : 0 > s && (s = 0)), h[_++] = {
                x: i,
                y: s
            };
            for (h.sort(function (t, e) {
                return t.x - e.x
            }), o = new c(1, 1, null), f = u; --f > -1;) a = h[f], o = new c(a.x, a.y, o);
            this._prev = new c(0, 0, 0 !== o.t ? o : o.next)
        }, !0), d = i.prototype = new t, d.constructor = i, d.getRatio = function (t) {
            var e = this._prev;
            if (t > e.t) {
                for (; e.next && t >= e.t;) e = e.next;
                e = e.prev
            } else for (; e.prev && e.t >= t;) e = e.prev;
            return this._prev = e, e.v + (t - e.t) / e.gap * e.c
        }, d.config = function (t) {
            return new i(t)
        }, i.ease = new i, u("Bounce", h("BounceOut", function (t) {
            return 1 / 2.75 > t ? 7.5625 * t * t : 2 / 2.75 > t ? 7.5625 * (t -= 1.5 / 2.75) * t + .75 : 2.5 / 2.75 > t ? 7.5625 * (t -= 2.25 / 2.75) * t + .9375 : 7.5625 * (t -= 2.625 / 2.75) * t + .984375
        }), h("BounceIn", function (t) {
            return 1 / 2.75 > (t = 1 - t) ? 1 - 7.5625 * t * t : 2 / 2.75 > t ? 1 - (7.5625 * (t -= 1.5 / 2.75) * t + .75) : 2.5 / 2.75 > t ? 1 - (7.5625 * (t -= 2.25 / 2.75) * t + .9375) : 1 - (7.5625 * (t -= 2.625 / 2.75) * t + .984375)
        }), h("BounceInOut", function (t) {
            var e = .5 > t;
            return t = e ? 1 - 2 * t : 2 * t - 1, t = 1 / 2.75 > t ? 7.5625 * t * t : 2 / 2.75 > t ? 7.5625 * (t -= 1.5 / 2.75) * t + .75 : 2.5 / 2.75 > t ? 7.5625 * (t -= 2.25 / 2.75) * t + .9375 : 7.5625 * (t -= 2.625 / 2.75) * t + .984375, e ? .5 * (1 - t) : .5 * t + .5
        })), u("Circ", h("CircOut", function (t) {
            return Math.sqrt(1 - (t -= 1) * t)
        }), h("CircIn", function (t) {
            return -(Math.sqrt(1 - t * t) - 1)
        }), h("CircInOut", function (t) {
            return 1 > (t *= 2) ? -.5 * (Math.sqrt(1 - t * t) - 1) : .5 * (Math.sqrt(1 - (t -= 2) * t) + 1)
        })), s = function (e, i, s) {
            var r = l("easing." + e, function (t, e) {
                this._p1 = t >= 1 ? t : 1, this._p2 = (e || s) / (1 > t ? t : 1), this._p3 = this._p2 / a * (Math.asin(1 / this._p1) || 0), this._p2 = a / this._p2
            }, !0), n = r.prototype = new t;
            return n.constructor = r, n.getRatio = i, n.config = function (t, e) {
                return new r(t, e)
            }, r
        }, u("Elastic", s("ElasticOut", function (t) {
            return this._p1 * Math.pow(2, -10 * t) * Math.sin((t - this._p3) * this._p2) + 1
        }, .3), s("ElasticIn", function (t) {
            return -(this._p1 * Math.pow(2, 10 * (t -= 1)) * Math.sin((t - this._p3) * this._p2))
        }, .3), s("ElasticInOut", function (t) {
            return 1 > (t *= 2) ? -.5 * this._p1 * Math.pow(2, 10 * (t -= 1)) * Math.sin((t - this._p3) * this._p2) : .5 * this._p1 * Math.pow(2, -10 * (t -= 1)) * Math.sin((t - this._p3) * this._p2) + 1
        }, .45)), u("Expo", h("ExpoOut", function (t) {
            return 1 - Math.pow(2, -10 * t)
        }), h("ExpoIn", function (t) {
            return Math.pow(2, 10 * (t - 1)) - .001
        }), h("ExpoInOut", function (t) {
            return 1 > (t *= 2) ? .5 * Math.pow(2, 10 * (t - 1)) : .5 * (2 - Math.pow(2, -10 * (t - 1)))
        })), u("Sine", h("SineOut", function (t) {
            return Math.sin(t * o)
        }), h("SineIn", function (t) {
            return -Math.cos(t * o) + 1
        }), h("SineInOut", function (t) {
            return -.5 * (Math.cos(Math.PI * t) - 1)
        })), l("easing.EaseLookup", {
            find: function (e) {
                return t.map[e]
            }
        }, !0), _(r.SlowMo, "SlowMo", "ease,"), _(i, "RoughEase", "ease,"), _(e, "SteppedEase", "ease,"), p
    }, !0)
}), _gsScope._gsDefine && _gsScope._gsQueue.pop()(), function (t, e) {
    "use strict";
    var i = t.GreenSockGlobals = t.GreenSockGlobals || t;
    if (!i.TweenLite) {
        var s, r, n, a, o, l = function (t) {
            var e, s = t.split("."), r = i;
            for (e = 0; s.length > e; e++) r[s[e]] = r = r[s[e]] || {};
            return r
        }, h = l("com.greensock"), _ = 1e-10, u = function (t) {
            var e, i = [], s = t.length;
            for (e = 0; e !== s; i.push(t[e++])) ;
            return i
        }, c = function () {
        }, f = function () {
            var t = Object.prototype.toString, e = t.call([]);
            return function (i) {
                return null != i && (i instanceof Array || "object" == typeof i && !!i.push && t.call(i) === e)
            }
        }(), p = {}, m = function (s, r, n, a) {
            this.sc = p[s] ? p[s].sc : [], p[s] = this, this.gsClass = null, this.func = n;
            var o = [];
            this.check = function (h) {
                for (var _, u, c, f, d, g = r.length, v = g; --g > -1;) (_ = p[r[g]] || new m(r[g], [])).gsClass ? (o[g] = _.gsClass, v--) : h && _.sc.push(this);
                if (0 === v && n) for (u = ("com.greensock." + s).split("."), c = u.pop(), f = l(u.join("."))[c] = this.gsClass = n.apply(n, o), a && (i[c] = f, d = "undefined" != typeof module && module.exports, !d && "function" == typeof define && define.amd ? define((t.GreenSockAMDPath ? t.GreenSockAMDPath + "/" : "") + s.split(".").pop(), [], function () {
                    return f
                }) : s === e && d && (module.exports = f)), g = 0; this.sc.length > g; g++) this.sc[g].check()
            }, this.check(!0)
        }, d = t._gsDefine = function (t, e, i, s) {
            return new m(t, e, i, s)
        }, g = h._class = function (t, e, i) {
            return e = e || function () {
            }, d(t, [], function () {
                return e
            }, i), e
        };
        d.globals = i;
        var v = [0, 0, 1, 1], y = [], T = g("easing.Ease", function (t, e, i, s) {
            this._func = t, this._type = i || 0, this._power = s || 0, this._params = e ? v.concat(e) : v
        }, !0), x = T.map = {}, w = T.register = function (t, e, i, s) {
            for (var r, n, a, o, l = e.split(","), _ = l.length, u = (i || "easeIn,easeOut,easeInOut").split(","); --_ > -1;) for (n = l[_], r = s ? g("easing." + n, null, !0) : h.easing[n] || {}, a = u.length; --a > -1;) o = u[a], x[n + "." + o] = x[o + n] = r[o] = t.getRatio ? t : t[o] || new t
        };
        for (n = T.prototype, n._calcEnd = !1, n.getRatio = function (t) {
            if (this._func) return this._params[0] = t, this._func.apply(null, this._params);
            var e = this._type, i = this._power, s = 1 === e ? 1 - t : 2 === e ? t : .5 > t ? 2 * t : 2 * (1 - t);
            return 1 === i ? s *= s : 2 === i ? s *= s * s : 3 === i ? s *= s * s * s : 4 === i && (s *= s * s * s * s), 1 === e ? 1 - s : 2 === e ? s : .5 > t ? s / 2 : 1 - s / 2
        }, s = ["Linear", "Quad", "Cubic", "Quart", "Quint,Strong"], r = s.length; --r > -1;) n = s[r] + ",Power" + r, w(new T(null, null, 1, r), n, "easeOut", !0), w(new T(null, null, 2, r), n, "easeIn" + (0 === r ? ",easeNone" : "")), w(new T(null, null, 3, r), n, "easeInOut");
        x.linear = h.easing.Linear.easeIn, x.swing = h.easing.Quad.easeInOut;
        var b = g("events.EventDispatcher", function (t) {
            this._listeners = {}, this._eventTarget = t || this
        });
        n = b.prototype, n.addEventListener = function (t, e, i, s, r) {
            r = r || 0;
            var n, l, h = this._listeners[t], _ = 0;
            for (null == h && (this._listeners[t] = h = []), l = h.length; --l > -1;) n = h[l], n.c === e && n.s === i ? h.splice(l, 1) : 0 === _ && r > n.pr && (_ = l + 1);
            h.splice(_, 0, {c: e, s: i, up: s, pr: r}), this !== a || o || a.wake()
        }, n.removeEventListener = function (t, e) {
            var i, s = this._listeners[t];
            if (s) for (i = s.length; --i > -1;) if (s[i].c === e) return s.splice(i, 1), void 0
        }, n.dispatchEvent = function (t) {
            var e, i, s, r = this._listeners[t];
            if (r) for (e = r.length, i = this._eventTarget; --e > -1;) s = r[e], s && (s.up ? s.c.call(s.s || i, {
                type: t,
                target: i
            }) : s.c.call(s.s || i))
        };
        var P = t.requestAnimationFrame, k = t.cancelAnimationFrame, S = Date.now || function () {
            return (new Date).getTime()
        }, R = S();
        for (s = ["ms", "moz", "webkit", "o"], r = s.length; --r > -1 && !P;) P = t[s[r] + "RequestAnimationFrame"], k = t[s[r] + "CancelAnimationFrame"] || t[s[r] + "CancelRequestAnimationFrame"];
        g("Ticker", function (t, e) {
            var i, s, r, n, l, h = this, u = S(), f = e !== !1 && P, p = 500, m = 33, d = "tick", g = function (t) {
                var e, a, o = S() - R;
                o > p && (u += o - m), R += o, h.time = (R - u) / 1e3, e = h.time - l, (!i || e > 0 || t === !0) && (h.frame++, l += e + (e >= n ? .004 : n - e), a = !0), t !== !0 && (r = s(g)), a && h.dispatchEvent(d)
            };
            b.call(h), h.time = h.frame = 0, h.tick = function () {
                g(!0)
            }, h.lagSmoothing = function (t, e) {
                p = t || 1 / _, m = Math.min(e, p, 0)
            }, h.sleep = function () {
                null != r && (f && k ? k(r) : clearTimeout(r), s = c, r = null, h === a && (o = !1))
            }, h.wake = function () {
                null !== r ? h.sleep() : h.frame > 10 && (R = S() - p + 5), s = 0 === i ? c : f && P ? P : function (t) {
                    return setTimeout(t, 0 | 1e3 * (l - h.time) + 1)
                }, h === a && (o = !0), g(2)
            }, h.fps = function (t) {
                return arguments.length ? (i = t, n = 1 / (i || 60), l = this.time + n, h.wake(), void 0) : i
            }, h.useRAF = function (t) {
                return arguments.length ? (h.sleep(), f = t, h.fps(i), void 0) : f
            }, h.fps(t), setTimeout(function () {
                f && 5 > h.frame && h.useRAF(!1)
            }, 1500)
        }), n = h.Ticker.prototype = new h.events.EventDispatcher, n.constructor = h.Ticker;
        var O = g("core.Animation", function (t, e) {
            if (this.vars = e = e || {}, this._duration = this._totalDuration = t || 0, this._delay = Number(e.delay) || 0, this._timeScale = 1, this._active = e.immediateRender === !0, this.data = e.data, this._reversed = e.reversed === !0, W) {
                o || a.wake();
                var i = this.vars.useFrames ? G : W;
                i.add(this, i._time), this.vars.paused && this.paused(!0)
            }
        });
        a = O.ticker = new h.Ticker, n = O.prototype, n._dirty = n._gc = n._initted = n._paused = !1, n._totalTime = n._time = 0, n._rawPrevTime = -1, n._next = n._last = n._onUpdate = n._timeline = n.timeline = null, n._paused = !1;
        var A = function () {
            o && S() - R > 2e3 && a.wake(), setTimeout(A, 2e3)
        };
        A(), n.play = function (t, e) {
            return null != t && this.seek(t, e), this.reversed(!1).paused(!1)
        }, n.pause = function (t, e) {
            return null != t && this.seek(t, e), this.paused(!0)
        }, n.resume = function (t, e) {
            return null != t && this.seek(t, e), this.paused(!1)
        }, n.seek = function (t, e) {
            return this.totalTime(Number(t), e !== !1)
        }, n.restart = function (t, e) {
            return this.reversed(!1).paused(!1).totalTime(t ? -this._delay : 0, e !== !1, !0)
        }, n.reverse = function (t, e) {
            return null != t && this.seek(t || this.totalDuration(), e), this.reversed(!0).paused(!1)
        }, n.render = function () {
        }, n.invalidate = function () {
            return this._time = this._totalTime = 0, this._initted = this._gc = !1, this._rawPrevTime = -1, (this._gc || !this.timeline) && this._enabled(!0), this
        }, n.isActive = function () {
            var t, e = this._timeline, i = this._startTime;
            return !e || !this._gc && !this._paused && e.isActive() && (t = e.rawTime()) >= i && i + this.totalDuration() / this._timeScale > t
        }, n._enabled = function (t, e) {
            return o || a.wake(), this._gc = !t, this._active = this.isActive(), e !== !0 && (t && !this.timeline ? this._timeline.add(this, this._startTime - this._delay) : !t && this.timeline && this._timeline._remove(this, !0)), !1
        }, n._kill = function () {
            return this._enabled(!1, !1)
        }, n.kill = function (t, e) {
            return this._kill(t, e), this
        }, n._uncache = function (t) {
            for (var e = t ? this : this.timeline; e;) e._dirty = !0, e = e.timeline;
            return this
        }, n._swapSelfInParams = function (t) {
            for (var e = t.length, i = t.concat(); --e > -1;) "{self}" === t[e] && (i[e] = this);
            return i
        }, n._callback = function (t) {
            var e = this.vars;
            e[t].apply(e[t + "Scope"] || e.callbackScope || this, e[t + "Params"] || y)
        }, n.eventCallback = function (t, e, i, s) {
            if ("on" === (t || "").substr(0, 2)) {
                var r = this.vars;
                if (1 === arguments.length) return r[t];
                null == e ? delete r[t] : (r[t] = e, r[t + "Params"] = f(i) && -1 !== i.join("").indexOf("{self}") ? this._swapSelfInParams(i) : i, r[t + "Scope"] = s), "onUpdate" === t && (this._onUpdate = e)
            }
            return this
        }, n.delay = function (t) {
            return arguments.length ? (this._timeline.smoothChildTiming && this.startTime(this._startTime + t - this._delay), this._delay = t, this) : this._delay
        }, n.duration = function (t) {
            return arguments.length ? (this._duration = this._totalDuration = t, this._uncache(!0), this._timeline.smoothChildTiming && this._time > 0 && this._time < this._duration && 0 !== t && this.totalTime(this._totalTime * (t / this._duration), !0), this) : (this._dirty = !1, this._duration)
        }, n.totalDuration = function (t) {
            return this._dirty = !1, arguments.length ? this.duration(t) : this._totalDuration
        }, n.time = function (t, e) {
            return arguments.length ? (this._dirty && this.totalDuration(), this.totalTime(t > this._duration ? this._duration : t, e)) : this._time
        }, n.totalTime = function (t, e, i) {
            if (o || a.wake(), !arguments.length) return this._totalTime;
            if (this._timeline) {
                if (0 > t && !i && (t += this.totalDuration()), this._timeline.smoothChildTiming) {
                    this._dirty && this.totalDuration();
                    var s = this._totalDuration, r = this._timeline;
                    if (t > s && !i && (t = s), this._startTime = (this._paused ? this._pauseTime : r._time) - (this._reversed ? s - t : t) / this._timeScale, r._dirty || this._uncache(!1), r._timeline) for (; r._timeline;) r._timeline._time !== (r._startTime + r._totalTime) / r._timeScale && r.totalTime(r._totalTime, !0), r = r._timeline
                }
                this._gc && this._enabled(!0, !1), (this._totalTime !== t || 0 === this._duration) && (F.length && Q(), this.render(t, e, !1), F.length && Q())
            }
            return this
        }, n.progress = n.totalProgress = function (t, e) {
            var i = this.duration();
            return arguments.length ? this.totalTime(i * t, e) : i ? this._time / i : this.ratio
        }, n.startTime = function (t) {
            return arguments.length ? (t !== this._startTime && (this._startTime = t, this.timeline && this.timeline._sortChildren && this.timeline.add(this, t - this._delay)), this) : this._startTime
        }, n.endTime = function (t) {
            return this._startTime + (0 != t ? this.totalDuration() : this.duration()) / this._timeScale
        }, n.timeScale = function (t) {
            if (!arguments.length) return this._timeScale;
            if (t = t || _, this._timeline && this._timeline.smoothChildTiming) {
                var e = this._pauseTime, i = e || 0 === e ? e : this._timeline.totalTime();
                this._startTime = i - (i - this._startTime) * this._timeScale / t
            }
            return this._timeScale = t, this._uncache(!1)
        }, n.reversed = function (t) {
            return arguments.length ? (t != this._reversed && (this._reversed = t, this.totalTime(this._timeline && !this._timeline.smoothChildTiming ? this.totalDuration() - this._totalTime : this._totalTime, !0)), this) : this._reversed
        }, n.paused = function (t) {
            if (!arguments.length) return this._paused;
            var e, i, s = this._timeline;
            return t != this._paused && s && (o || t || a.wake(), e = s.rawTime(), i = e - this._pauseTime, !t && s.smoothChildTiming && (this._startTime += i, this._uncache(!1)), this._pauseTime = t ? e : null, this._paused = t, this._active = this.isActive(), !t && 0 !== i && this._initted && this.duration() && (e = s.smoothChildTiming ? this._totalTime : (e - this._startTime) / this._timeScale, this.render(e, e === this._totalTime, !0))), this._gc && !t && this._enabled(!0, !1), this
        };
        var C = g("core.SimpleTimeline", function (t) {
            O.call(this, 0, t), this.autoRemoveChildren = this.smoothChildTiming = !0
        });
        n = C.prototype = new O, n.constructor = C, n.kill()._gc = !1, n._first = n._last = n._recent = null, n._sortChildren = !1, n.add = n.insert = function (t, e) {
            var i, s;
            if (t._startTime = Number(e || 0) + t._delay, t._paused && this !== t._timeline && (t._pauseTime = t._startTime + (this.rawTime() - t._startTime) / t._timeScale), t.timeline && t.timeline._remove(t, !0), t.timeline = t._timeline = this, t._gc && t._enabled(!0, !0), i = this._last, this._sortChildren) for (s = t._startTime; i && i._startTime > s;) i = i._prev;
            return i ? (t._next = i._next, i._next = t) : (t._next = this._first, this._first = t), t._next ? t._next._prev = t : this._last = t, t._prev = i, this._recent = t, this._timeline && this._uncache(!0), this
        }, n._remove = function (t, e) {
            return t.timeline === this && (e || t._enabled(!1, !0), t._prev ? t._prev._next = t._next : this._first === t && (this._first = t._next), t._next ? t._next._prev = t._prev : this._last === t && (this._last = t._prev), t._next = t._prev = t.timeline = null, t === this._recent && (this._recent = this._last), this._timeline && this._uncache(!0)), this
        }, n.render = function (t, e, i) {
            var s, r = this._first;
            for (this._totalTime = this._time = this._rawPrevTime = t; r;) s = r._next, (r._active || t >= r._startTime && !r._paused) && (r._reversed ? r.render((r._dirty ? r.totalDuration() : r._totalDuration) - (t - r._startTime) * r._timeScale, e, i) : r.render((t - r._startTime) * r._timeScale, e, i)), r = s
        }, n.rawTime = function () {
            return o || a.wake(), this._totalTime
        };
        var D = g("TweenLite", function (e, i, s) {
            if (O.call(this, i, s), this.render = D.prototype.render, null == e) throw"Cannot tween a null target.";
            this.target = e = "string" != typeof e ? e : D.selector(e) || e;
            var r, n, a,
                o = e.jquery || e.length && e !== t && e[0] && (e[0] === t || e[0].nodeType && e[0].style && !e.nodeType),
                l = this.vars.overwrite;
            if (this._overwrite = l = null == l ? V[D.defaultOverwrite] : "number" == typeof l ? l >> 0 : V[l], (o || e instanceof Array || e.push && f(e)) && "number" != typeof e[0]) for (this._targets = a = u(e), this._propLookup = [], this._siblings = [], r = 0; a.length > r; r++) n = a[r], n ? "string" != typeof n ? n.length && n !== t && n[0] && (n[0] === t || n[0].nodeType && n[0].style && !n.nodeType) ? (a.splice(r--, 1), this._targets = a = a.concat(u(n))) : (this._siblings[r] = $(n, this, !1), 1 === l && this._siblings[r].length > 1 && K(n, this, null, 1, this._siblings[r])) : (n = a[r--] = D.selector(n), "string" == typeof n && a.splice(r + 1, 1)) : a.splice(r--, 1); else this._propLookup = {}, this._siblings = $(e, this, !1), 1 === l && this._siblings.length > 1 && K(e, this, null, 1, this._siblings);
            (this.vars.immediateRender || 0 === i && 0 === this._delay && this.vars.immediateRender !== !1) && (this._time = -_, this.render(-this._delay))
        }, !0), M = function (e) {
            return e && e.length && e !== t && e[0] && (e[0] === t || e[0].nodeType && e[0].style && !e.nodeType)
        }, z = function (t, e) {
            var i, s = {};
            for (i in t) q[i] || i in e && "transform" !== i && "x" !== i && "y" !== i && "width" !== i && "height" !== i && "className" !== i && "border" !== i || !(!j[i] || j[i] && j[i]._autoCSS) || (s[i] = t[i], delete t[i]);
            t.css = s
        };
        n = D.prototype = new O, n.constructor = D, n.kill()._gc = !1, n.ratio = 0, n._firstPT = n._targets = n._overwrittenProps = n._startAt = null, n._notifyPluginsOfEnabled = n._lazy = !1, D.version = "1.18.0", D.defaultEase = n._ease = new T(null, null, 1, 1), D.defaultOverwrite = "auto", D.ticker = a, D.autoSleep = 120, D.lagSmoothing = function (t, e) {
            a.lagSmoothing(t, e)
        }, D.selector = t.$ || t.jQuery || function (e) {
            var i = t.$ || t.jQuery;
            return i ? (D.selector = i, i(e)) : "undefined" == typeof document ? e : document.querySelectorAll ? document.querySelectorAll(e) : document.getElementById("#" === e.charAt(0) ? e.substr(1) : e)
        };
        var F = [], I = {}, E = /(?:(-|-=|\+=)?\d*\.?\d*(?:e[\-+]?\d+)?)[0-9]/gi, N = function (t) {
                for (var e, i = this._firstPT, s = 1e-6; i;) e = i.blob ? t ? this.join("") : this.start : i.c * t + i.s, i.r ? e = Math.round(e) : s > e && e > -s && (e = 0), i.f ? i.fp ? i.t[i.p](i.fp, e) : i.t[i.p](e) : i.t[i.p] = e, i = i._next
            }, L = function (t, e, i, s) {
                var r, n, a, o, l, h, _, u = [t, e], c = 0, f = "", p = 0;
                for (u.start = t, i && (i(u), t = u[0], e = u[1]), u.length = 0, r = t.match(E) || [], n = e.match(E) || [], s && (s._next = null, s.blob = 1, u._firstPT = s), l = n.length, o = 0; l > o; o++) _ = n[o], h = e.substr(c, e.indexOf(_, c) - c), f += h || !o ? h : ",", c += h.length, p ? p = (p + 1) % 5 : "rgba(" === h.substr(-5) && (p = 1), _ === r[o] || o >= r.length ? f += _ : (f && (u.push(f), f = ""), a = parseFloat(r[o]), u.push(a), u._firstPT = {
                    _next: u._firstPT,
                    t: u,
                    p: u.length - 1,
                    s: a,
                    c: ("=" === _.charAt(1) ? parseInt(_.charAt(0) + "1", 10) * parseFloat(_.substr(2)) : parseFloat(_) - a) || 0,
                    f: 0,
                    r: p && 4 > p
                }), c += _.length;
                return f += e.substr(c), f && u.push(f), u.setRatio = N, u
            }, X = function (t, e, i, s, r, n, a, o) {
                var l, h, _ = "get" === i ? t[e] : i, u = typeof t[e], c = "string" == typeof s && "=" === s.charAt(1),
                    f = {
                        t: t,
                        p: e,
                        s: _,
                        f: "function" === u,
                        pg: 0,
                        n: r || e,
                        r: n,
                        pr: 0,
                        c: c ? parseInt(s.charAt(0) + "1", 10) * parseFloat(s.substr(2)) : parseFloat(s) - _ || 0
                    };
                return "number" !== u && ("function" === u && "get" === i && (h = e.indexOf("set") || "function" != typeof t["get" + e.substr(3)] ? e : "get" + e.substr(3), f.s = _ = a ? t[h](a) : t[h]()), "string" == typeof _ && (a || isNaN(_)) ? (f.fp = a, l = L(_, s, o || D.defaultStringFilter, f), f = {
                    t: l,
                    p: "setRatio",
                    s: 0,
                    c: 1,
                    f: 2,
                    pg: 0,
                    n: r || e,
                    pr: 0
                }) : c || (f.c = parseFloat(s) - parseFloat(_) || 0)), f.c ? ((f._next = this._firstPT) && (f._next._prev = f), this._firstPT = f, f) : void 0
            }, B = D._internals = {isArray: f, isSelector: M, lazyTweens: F, blobDif: L}, j = D._plugins = {},
            Y = B.tweenLookup = {}, U = 0, q = B.reservedProps = {
                ease: 1,
                delay: 1,
                overwrite: 1,
                onComplete: 1,
                onCompleteParams: 1,
                onCompleteScope: 1,
                useFrames: 1,
                runBackwards: 1,
                startAt: 1,
                onUpdate: 1,
                onUpdateParams: 1,
                onUpdateScope: 1,
                onStart: 1,
                onStartParams: 1,
                onStartScope: 1,
                onReverseComplete: 1,
                onReverseCompleteParams: 1,
                onReverseCompleteScope: 1,
                onRepeat: 1,
                onRepeatParams: 1,
                onRepeatScope: 1,
                easeParams: 1,
                yoyo: 1,
                immediateRender: 1,
                repeat: 1,
                repeatDelay: 1,
                data: 1,
                paused: 1,
                reversed: 1,
                autoCSS: 1,
                lazy: 1,
                onOverwrite: 1,
                callbackScope: 1,
                stringFilter: 1
            }, V = {none: 0, all: 1, auto: 2, concurrent: 3, allOnStart: 4, preexisting: 5, "true": 1, "false": 0},
            G = O._rootFramesTimeline = new C, W = O._rootTimeline = new C, Z = 30, Q = B.lazyRender = function () {
                var t, e = F.length;
                for (I = {}; --e > -1;) t = F[e], t && t._lazy !== !1 && (t.render(t._lazy[0], t._lazy[1], !0), t._lazy = !1);
                F.length = 0
            };
        W._startTime = a.time, G._startTime = a.frame, W._active = G._active = !0, setTimeout(Q, 1), O._updateRoot = D.render = function () {
            var t, e, i;
            if (F.length && Q(), W.render((a.time - W._startTime) * W._timeScale, !1, !1), G.render((a.frame - G._startTime) * G._timeScale, !1, !1), F.length && Q(), a.frame >= Z) {
                Z = a.frame + (parseInt(D.autoSleep, 10) || 120);
                for (i in Y) {
                    for (e = Y[i].tweens, t = e.length; --t > -1;) e[t]._gc && e.splice(t, 1);
                    0 === e.length && delete Y[i]
                }
                if (i = W._first, (!i || i._paused) && D.autoSleep && !G._first && 1 === a._listeners.tick.length) {
                    for (; i && i._paused;) i = i._next;
                    i || a.sleep()
                }
            }
        }, a.addEventListener("tick", O._updateRoot);
        var $ = function (t, e, i) {
            var s, r, n = t._gsTweenID;
            if (Y[n || (t._gsTweenID = n = "t" + U++)] || (Y[n] = {
                target: t,
                tweens: []
            }), e && (s = Y[n].tweens, s[r = s.length] = e, i)) for (; --r > -1;) s[r] === e && s.splice(r, 1);
            return Y[n].tweens
        }, H = function (t, e, i, s) {
            var r, n, a = t.vars.onOverwrite;
            return a && (r = a(t, e, i, s)), a = D.onOverwrite, a && (n = a(t, e, i, s)), r !== !1 && n !== !1
        }, K = function (t, e, i, s, r) {
            var n, a, o, l;
            if (1 === s || s >= 4) {
                for (l = r.length, n = 0; l > n; n++) if ((o = r[n]) !== e) o._gc || o._kill(null, t, e) && (a = !0); else if (5 === s) break;
                return a
            }
            var h, u = e._startTime + _, c = [], f = 0, p = 0 === e._duration;
            for (n = r.length; --n > -1;) (o = r[n]) === e || o._gc || o._paused || (o._timeline !== e._timeline ? (h = h || J(e, 0, p), 0 === J(o, h, p) && (c[f++] = o)) : u >= o._startTime && o._startTime + o.totalDuration() / o._timeScale > u && ((p || !o._initted) && 2e-10 >= u - o._startTime || (c[f++] = o)));
            for (n = f; --n > -1;) if (o = c[n], 2 === s && o._kill(i, t, e) && (a = !0), 2 !== s || !o._firstPT && o._initted) {
                if (2 !== s && !H(o, e)) continue;
                o._enabled(!1, !1) && (a = !0)
            }
            return a
        }, J = function (t, e, i) {
            for (var s = t._timeline, r = s._timeScale, n = t._startTime; s._timeline;) {
                if (n += s._startTime, r *= s._timeScale, s._paused) return -100;
                s = s._timeline
            }
            return n /= r, n > e ? n - e : i && n === e || !t._initted && 2 * _ > n - e ? _ : (n += t.totalDuration() / t._timeScale / r) > e + _ ? 0 : n - e - _
        };
        n._init = function () {
            var t, e, i, s, r, n = this.vars, a = this._overwrittenProps, o = this._duration, l = !!n.immediateRender,
                h = n.ease;
            if (n.startAt) {
                this._startAt && (this._startAt.render(-1, !0), this._startAt.kill()), r = {};
                for (s in n.startAt) r[s] = n.startAt[s];
                if (r.overwrite = !1, r.immediateRender = !0, r.lazy = l && n.lazy !== !1, r.startAt = r.delay = null, this._startAt = D.to(this.target, 0, r), l) if (this._time > 0) this._startAt = null; else if (0 !== o) return
            } else if (n.runBackwards && 0 !== o) if (this._startAt) this._startAt.render(-1, !0), this._startAt.kill(), this._startAt = null; else {
                0 !== this._time && (l = !1), i = {};
                for (s in n) q[s] && "autoCSS" !== s || (i[s] = n[s]);
                if (i.overwrite = 0, i.data = "isFromStart", i.lazy = l && n.lazy !== !1, i.immediateRender = l, this._startAt = D.to(this.target, 0, i), l) {
                    if (0 === this._time) return
                } else this._startAt._init(), this._startAt._enabled(!1), this.vars.immediateRender && (this._startAt = null)
            }
            if (this._ease = h = h ? h instanceof T ? h : "function" == typeof h ? new T(h, n.easeParams) : x[h] || D.defaultEase : D.defaultEase, n.easeParams instanceof Array && h.config && (this._ease = h.config.apply(h, n.easeParams)), this._easeType = this._ease._type, this._easePower = this._ease._power, this._firstPT = null, this._targets) for (t = this._targets.length; --t > -1;) this._initProps(this._targets[t], this._propLookup[t] = {}, this._siblings[t], a ? a[t] : null) && (e = !0); else e = this._initProps(this.target, this._propLookup, this._siblings, a);
            if (e && D._onPluginEvent("_onInitAllProps", this), a && (this._firstPT || "function" != typeof this.target && this._enabled(!1, !1)), n.runBackwards) for (i = this._firstPT; i;) i.s += i.c, i.c = -i.c, i = i._next;
            this._onUpdate = n.onUpdate, this._initted = !0
        }, n._initProps = function (e, i, s, r) {
            var n, a, o, l, h, _;
            if (null == e) return !1;
            I[e._gsTweenID] && Q(), this.vars.css || e.style && e !== t && e.nodeType && j.css && this.vars.autoCSS !== !1 && z(this.vars, e);
            for (n in this.vars) if (_ = this.vars[n], q[n]) _ && (_ instanceof Array || _.push && f(_)) && -1 !== _.join("").indexOf("{self}") && (this.vars[n] = _ = this._swapSelfInParams(_, this)); else if (j[n] && (l = new j[n])._onInitTween(e, this.vars[n], this)) {
                for (this._firstPT = h = {
                    _next: this._firstPT,
                    t: l,
                    p: "setRatio",
                    s: 0,
                    c: 1,
                    f: 1,
                    n: n,
                    pg: 1,
                    pr: l._priority
                }, a = l._overwriteProps.length; --a > -1;) i[l._overwriteProps[a]] = this._firstPT;
                (l._priority || l._onInitAllProps) && (o = !0), (l._onDisable || l._onEnable) && (this._notifyPluginsOfEnabled = !0), h._next && (h._next._prev = h)
            } else i[n] = X.call(this, e, n, "get", _, n, 0, null, this.vars.stringFilter);
            return r && this._kill(r, e) ? this._initProps(e, i, s, r) : this._overwrite > 1 && this._firstPT && s.length > 1 && K(e, this, i, this._overwrite, s) ? (this._kill(i, e), this._initProps(e, i, s, r)) : (this._firstPT && (this.vars.lazy !== !1 && this._duration || this.vars.lazy && !this._duration) && (I[e._gsTweenID] = !0), o)
        }, n.render = function (t, e, i) {
            var s, r, n, a, o = this._time, l = this._duration, h = this._rawPrevTime;
            if (t >= l) this._totalTime = this._time = l, this.ratio = this._ease._calcEnd ? this._ease.getRatio(1) : 1, this._reversed || (s = !0, r = "onComplete", i = i || this._timeline.autoRemoveChildren), 0 === l && (this._initted || !this.vars.lazy || i) && (this._startTime === this._timeline._duration && (t = 0), (0 === t || 0 > h || h === _ && "isPause" !== this.data) && h !== t && (i = !0, h > _ && (r = "onReverseComplete")), this._rawPrevTime = a = !e || t || h === t ? t : _); else if (1e-7 > t) this._totalTime = this._time = 0, this.ratio = this._ease._calcEnd ? this._ease.getRatio(0) : 0, (0 !== o || 0 === l && h > 0) && (r = "onReverseComplete", s = this._reversed), 0 > t && (this._active = !1, 0 === l && (this._initted || !this.vars.lazy || i) && (h >= 0 && (h !== _ || "isPause" !== this.data) && (i = !0), this._rawPrevTime = a = !e || t || h === t ? t : _)), this._initted || (i = !0); else if (this._totalTime = this._time = t, this._easeType) {
                var u = t / l, c = this._easeType, f = this._easePower;
                (1 === c || 3 === c && u >= .5) && (u = 1 - u), 3 === c && (u *= 2), 1 === f ? u *= u : 2 === f ? u *= u * u : 3 === f ? u *= u * u * u : 4 === f && (u *= u * u * u * u), this.ratio = 1 === c ? 1 - u : 2 === c ? u : .5 > t / l ? u / 2 : 1 - u / 2
            } else this.ratio = this._ease.getRatio(t / l);
            if (this._time !== o || i) {
                if (!this._initted) {
                    if (this._init(), !this._initted || this._gc) return;
                    if (!i && this._firstPT && (this.vars.lazy !== !1 && this._duration || this.vars.lazy && !this._duration)) return this._time = this._totalTime = o, this._rawPrevTime = h, F.push(this), this._lazy = [t, e], void 0;
                    this._time && !s ? this.ratio = this._ease.getRatio(this._time / l) : s && this._ease._calcEnd && (this.ratio = this._ease.getRatio(0 === this._time ? 0 : 1))
                }
                for (this._lazy !== !1 && (this._lazy = !1), this._active || !this._paused && this._time !== o && t >= 0 && (this._active = !0), 0 === o && (this._startAt && (t >= 0 ? this._startAt.render(t, e, i) : r || (r = "_dummyGS")), this.vars.onStart && (0 !== this._time || 0 === l) && (e || this._callback("onStart"))), n = this._firstPT; n;) n.f ? n.t[n.p](n.c * this.ratio + n.s) : n.t[n.p] = n.c * this.ratio + n.s, n = n._next;
                this._onUpdate && (0 > t && this._startAt && t !== -1e-4 && this._startAt.render(t, e, i), e || (this._time !== o || s) && this._callback("onUpdate")), r && (!this._gc || i) && (0 > t && this._startAt && !this._onUpdate && t !== -1e-4 && this._startAt.render(t, e, i), s && (this._timeline.autoRemoveChildren && this._enabled(!1, !1), this._active = !1), !e && this.vars[r] && this._callback(r), 0 === l && this._rawPrevTime === _ && a !== _ && (this._rawPrevTime = 0))
            }
        }, n._kill = function (t, e, i) {
            if ("all" === t && (t = null), null == t && (null == e || e === this.target)) return this._lazy = !1, this._enabled(!1, !1);
            e = "string" != typeof e ? e || this._targets || this.target : D.selector(e) || e;
            var s, r, n, a, o, l, h, _, u,
                c = i && this._time && i._startTime === this._startTime && this._timeline === i._timeline;
            if ((f(e) || M(e)) && "number" != typeof e[0]) for (s = e.length; --s > -1;) this._kill(t, e[s], i) && (l = !0); else {
                if (this._targets) {
                    for (s = this._targets.length; --s > -1;) if (e === this._targets[s]) {
                        o = this._propLookup[s] || {}, this._overwrittenProps = this._overwrittenProps || [], r = this._overwrittenProps[s] = t ? this._overwrittenProps[s] || {} : "all";
                        break
                    }
                } else {
                    if (e !== this.target) return !1;
                    o = this._propLookup, r = this._overwrittenProps = t ? this._overwrittenProps || {} : "all"
                }
                if (o) {
                    if (h = t || o, _ = t !== r && "all" !== r && t !== o && ("object" != typeof t || !t._tempKill), i && (D.onOverwrite || this.vars.onOverwrite)) {
                        for (n in h) o[n] && (u || (u = []), u.push(n));
                        if ((u || !t) && !H(this, i, e, u)) return !1
                    }
                    for (n in h) (a = o[n]) && (c && (a.f ? a.t[a.p](a.s) : a.t[a.p] = a.s, l = !0), a.pg && a.t._kill(h) && (l = !0), a.pg && 0 !== a.t._overwriteProps.length || (a._prev ? a._prev._next = a._next : a === this._firstPT && (this._firstPT = a._next), a._next && (a._next._prev = a._prev), a._next = a._prev = null), delete o[n]), _ && (r[n] = 1);
                    !this._firstPT && this._initted && this._enabled(!1, !1)
                }
            }
            return l
        }, n.invalidate = function () {
            return this._notifyPluginsOfEnabled && D._onPluginEvent("_onDisable", this), this._firstPT = this._overwrittenProps = this._startAt = this._onUpdate = null, this._notifyPluginsOfEnabled = this._active = this._lazy = !1, this._propLookup = this._targets ? {} : [], O.prototype.invalidate.call(this), this.vars.immediateRender && (this._time = -_, this.render(-this._delay)), this
        }, n._enabled = function (t, e) {
            if (o || a.wake(), t && this._gc) {
                var i, s = this._targets;
                if (s) for (i = s.length; --i > -1;) this._siblings[i] = $(s[i], this, !0); else this._siblings = $(this.target, this, !0)
            }
            return O.prototype._enabled.call(this, t, e), this._notifyPluginsOfEnabled && this._firstPT ? D._onPluginEvent(t ? "_onEnable" : "_onDisable", this) : !1
        }, D.to = function (t, e, i) {
            return new D(t, e, i)
        }, D.from = function (t, e, i) {
            return i.runBackwards = !0, i.immediateRender = 0 != i.immediateRender, new D(t, e, i)
        }, D.fromTo = function (t, e, i, s) {
            return s.startAt = i, s.immediateRender = 0 != s.immediateRender && 0 != i.immediateRender, new D(t, e, s)
        }, D.delayedCall = function (t, e, i, s, r) {
            return new D(e, 0, {
                delay: t,
                onComplete: e,
                onCompleteParams: i,
                callbackScope: s,
                onReverseComplete: e,
                onReverseCompleteParams: i,
                immediateRender: !1,
                lazy: !1,
                useFrames: r,
                overwrite: 0
            })
        }, D.set = function (t, e) {
            return new D(t, 0, e)
        }, D.getTweensOf = function (t, e) {
            if (null == t) return [];
            t = "string" != typeof t ? t : D.selector(t) || t;
            var i, s, r, n;
            if ((f(t) || M(t)) && "number" != typeof t[0]) {
                for (i = t.length, s = []; --i > -1;) s = s.concat(D.getTweensOf(t[i], e));
                for (i = s.length; --i > -1;) for (n = s[i], r = i; --r > -1;) n === s[r] && s.splice(i, 1)
            } else for (s = $(t).concat(), i = s.length; --i > -1;) (s[i]._gc || e && !s[i].isActive()) && s.splice(i, 1);
            return s
        }, D.killTweensOf = D.killDelayedCallsTo = function (t, e, i) {
            "object" == typeof e && (i = e, e = !1);
            for (var s = D.getTweensOf(t, e), r = s.length; --r > -1;) s[r]._kill(i, t)
        };
        var te = g("plugins.TweenPlugin", function (t, e) {
            this._overwriteProps = (t || "").split(","), this._propName = this._overwriteProps[0], this._priority = e || 0, this._super = te.prototype
        }, !0);
        if (n = te.prototype, te.version = "1.18.0", te.API = 2, n._firstPT = null, n._addTween = X, n.setRatio = N, n._kill = function (t) {
            var e, i = this._overwriteProps, s = this._firstPT;
            if (null != t[this._propName]) this._overwriteProps = []; else for (e = i.length; --e > -1;) null != t[i[e]] && i.splice(e, 1);
            for (; s;) null != t[s.n] && (s._next && (s._next._prev = s._prev), s._prev ? (s._prev._next = s._next, s._prev = null) : this._firstPT === s && (this._firstPT = s._next)), s = s._next;
            return !1
        }, n._roundProps = function (t, e) {
            for (var i = this._firstPT; i;) (t[this._propName] || null != i.n && t[i.n.split(this._propName + "_").join("")]) && (i.r = e), i = i._next
        }, D._onPluginEvent = function (t, e) {
            var i, s, r, n, a, o = e._firstPT;
            if ("_onInitAllProps" === t) {
                for (; o;) {
                    for (a = o._next, s = r; s && s.pr > o.pr;) s = s._next;
                    (o._prev = s ? s._prev : n) ? o._prev._next = o : r = o, (o._next = s) ? s._prev = o : n = o, o = a
                }
                o = e._firstPT = r
            }
            for (; o;) o.pg && "function" == typeof o.t[t] && o.t[t]() && (i = !0), o = o._next;
            return i
        }, te.activate = function (t) {
            for (var e = t.length; --e > -1;) t[e].API === te.API && (j[(new t[e])._propName] = t[e]);
            return !0
        }, d.plugin = function (t) {
            if (!(t && t.propName && t.init && t.API)) throw"illegal plugin definition.";
            var e, i = t.propName, s = t.priority || 0, r = t.overwriteProps, n = {
                init: "_onInitTween",
                set: "setRatio",
                kill: "_kill",
                round: "_roundProps",
                initAll: "_onInitAllProps"
            }, a = g("plugins." + i.charAt(0).toUpperCase() + i.substr(1) + "Plugin", function () {
                te.call(this, i, s), this._overwriteProps = r || []
            }, t.global === !0), o = a.prototype = new te(i);
            o.constructor = a, a.API = t.API;
            for (e in n) "function" == typeof t[e] && (o[n[e]] = t[e]);
            return a.version = t.version, te.activate([a]), a
        }, s = t._gsQueue) {
            for (r = 0; s.length > r; r++) s[r]();
            for (n in p) p[n].func || t.console.log("GSAP encountered missing dependency: com.greensock." + n)
        }
        o = !1
    }
}("undefined" != typeof module && module.exports && "undefined" != typeof global ? global : this || window, "TweenMax");

//ScrollMagic v2.0.5
!function (e, t) {
    "function" == typeof define && define.amd ? define(t) : "object" == typeof exports ? module.exports = t() : e.ScrollMagic = t()
}(this, function () {
    "use strict";
    var e = function () {
        o.log(2, "(COMPATIBILITY NOTICE) -> As of ScrollMagic 2.0.0 you need to use 'new ScrollMagic.Controller()' to create a new controller instance. Use 'new ScrollMagic.Scene()' to instance a scene.")
    };
    e.version = "2.0.5", window.addEventListener("mousewheel", function () {
    });
    var t = "data-scrollmagic-pin-spacer";
    e.Controller = function (r) {
        var i, l, s = "ScrollMagic.Controller", a = "REVERSE", c = "PAUSED", u = n.defaults, f = this,
            d = o.extend({}, u, r), g = [], p = !1, h = 0, v = c, m = !0, w = 0, y = !0, S = function () {
                d.refreshInterval > 0 && (l = window.setTimeout(F, d.refreshInterval))
            }, E = function () {
                return d.vertical ? o.get.scrollTop(d.container) : o.get.scrollLeft(d.container)
            }, b = function () {
                return d.vertical ? o.get.height(d.container) : o.get.width(d.container)
            }, R = this._setScrollPos = function (e) {
                d.vertical ? m ? window.scrollTo(o.get.scrollLeft(), e) : d.container.scrollTop = e : m ? window.scrollTo(e, o.get.scrollTop()) : d.container.scrollLeft = e
            }, T = function () {
                if (y && p) {
                    var e = o.type.Array(p) ? p : g.slice(0);
                    p = !1;
                    var t = h, n = (h = f.scrollPos()) - t;
                    0 !== n && (v = n > 0 ? "FORWARD" : a), v === a && e.reverse(), e.forEach(function (t, n) {
                        O(3, "updating Scene " + (n + 1) + "/" + e.length + " (" + g.length + " total)"), t.update(!0)
                    }), 0 === e.length && d.loglevel >= 3 && O(3, "updating 0 Scenes (nothing added to controller)")
                }
            }, C = function () {
                i = o.rAF(T)
            }, x = function (e) {
                O(3, "event fired causing an update:", e.type), "resize" == e.type && (w = b(), v = c), !0 !== p && (p = !0, C())
            }, F = function () {
                if (!m && w != b()) {
                    var e;
                    try {
                        e = new Event("resize", {bubbles: !1, cancelable: !1})
                    } catch (t) {
                        (e = document.createEvent("Event")).initEvent("resize", !1, !1)
                    }
                    d.container.dispatchEvent(e)
                }
                g.forEach(function (e, t) {
                    e.refresh()
                }), S()
            }, O = this._log = function (e, t) {
                d.loglevel >= e && (Array.prototype.splice.call(arguments, 1, 0, "(" + s + ") ->"), o.log.apply(window, arguments))
            };
        this._options = d;
        var z = function (e) {
            if (e.length <= 1) return e;
            var t = e.slice(0);
            return t.sort(function (e, t) {
                return e.scrollOffset() > t.scrollOffset() ? 1 : -1
            }), t
        };
        return this.addScene = function (t) {
            if (o.type.Array(t)) t.forEach(function (e, t) {
                f.addScene(e)
            }); else if (t instanceof e.Scene) {
                if (t.controller() !== f) t.addTo(f); else if (g.indexOf(t) < 0) {
                    g.push(t), g = z(g), t.on("shift.controller_sort", function () {
                        g = z(g)
                    });
                    for (var n in d.globalSceneOptions) t[n] && t[n].call(t, d.globalSceneOptions[n]);
                    O(3, "adding Scene (now " + g.length + " total)")
                }
            } else O(1, "ERROR: invalid argument supplied for '.addScene()'");
            return f
        }, this.removeScene = function (e) {
            if (o.type.Array(e)) e.forEach(function (e, t) {
                f.removeScene(e)
            }); else {
                var t = g.indexOf(e);
                t > -1 && (e.off("shift.controller_sort"), g.splice(t, 1), O(3, "removing Scene (now " + g.length + " left)"), e.remove())
            }
            return f
        }, this.updateScene = function (t, n) {
            return o.type.Array(t) ? t.forEach(function (e, t) {
                f.updateScene(e, n)
            }) : n ? t.update(!0) : !0 !== p && t instanceof e.Scene && (-1 == (p = p || []).indexOf(t) && p.push(t), p = z(p), C()), f
        }, this.update = function (e) {
            return x({type: "resize"}), e && T(), f
        }, this.scrollTo = function (n, r) {
            if (o.type.Number(n)) R.call(d.container, n, r); else if (n instanceof e.Scene) n.controller() === f ? f.scrollTo(n.scrollOffset(), r) : O(2, "scrollTo(): The supplied scene does not belong to this controller. Scroll cancelled.", n); else if (o.type.Function(n)) R = n; else {
                var i = o.get.elements(n)[0];
                if (i) {
                    for (; i.parentNode.hasAttribute(t);) i = i.parentNode;
                    var l = d.vertical ? "top" : "left", s = o.get.offset(d.container), a = o.get.offset(i);
                    m || (s[l] -= f.scrollPos()), f.scrollTo(a[l] - s[l], r)
                } else O(2, "scrollTo(): The supplied argument is invalid. Scroll cancelled.", n)
            }
            return f
        }, this.scrollPos = function (e) {
            return arguments.length ? (o.type.Function(e) ? E = e : O(2, "Provided value for method 'scrollPos' is not a function. To change the current scroll position use 'scrollTo()'."), f) : E.call(f)
        }, this.info = function (e) {
            var t = {
                size: w,
                vertical: d.vertical,
                scrollPos: h,
                scrollDirection: v,
                container: d.container,
                isDocument: m
            };
            return arguments.length ? void 0 !== t[e] ? t[e] : void O(1, 'ERROR: option "' + e + '" is not available') : t
        }, this.loglevel = function (e) {
            return arguments.length ? (d.loglevel != e && (d.loglevel = e), f) : d.loglevel
        }, this.enabled = function (e) {
            return arguments.length ? (y != e && (y = !!e, f.updateScene(g, !0)), f) : y
        }, this.destroy = function (e) {
            window.clearTimeout(l);
            for (var t = g.length; t--;) g[t].destroy(e);
            return d.container.removeEventListener("resize", x), d.container.removeEventListener("scroll", x), o.cAF(i), O(3, "destroyed " + s + " (reset: " + (e ? "true" : "false") + ")"), null
        }, function () {
            for (var t in d) u.hasOwnProperty(t) || (O(2, 'WARNING: Unknown option "' + t + '"'), delete d[t]);
            if (d.container = o.get.elements(d.container)[0], !d.container) throw O(1, "ERROR creating object " + s + ": No valid scroll container supplied"), s + " init failed.";
            (m = d.container === window || d.container === document.body || !document.body.contains(d.container)) && (d.container = window), w = b(), d.container.addEventListener("resize", x), d.container.addEventListener("scroll", x), d.refreshInterval = parseInt(d.refreshInterval) || u.refreshInterval, S(), O(3, "added new " + s + " controller (v" + e.version + ")")
        }(), f
    };
    var n = {defaults: {container: window, vertical: !0, globalSceneOptions: {}, loglevel: 2, refreshInterval: 100}};
    e.Controller.addOption = function (e, t) {
        n.defaults[e] = t
    }, e.Controller.extend = function (t) {
        var n = this;
        e.Controller = function () {
            return n.apply(this, arguments), this.$super = o.extend({}, this), t.apply(this, arguments) || this
        }, o.extend(e.Controller, n), e.Controller.prototype = n.prototype, e.Controller.prototype.constructor = e.Controller
    }, e.Scene = function (n) {
        var i, l, s = "ScrollMagic.Scene", a = "BEFORE", c = "DURING", u = "AFTER", f = r.defaults, d = this,
            g = o.extend({}, f, n), p = a, h = 0, v = {start: 0, end: 0}, m = 0, w = !0, y = {};
        this.on = function (e, t) {
            return o.type.Function(t) ? (e = e.trim().split(" ")).forEach(function (e) {
                var n = e.split("."), r = n[0], o = n[1];
                "*" != r && (y[r] || (y[r] = []), y[r].push({namespace: o || "", callback: t}))
            }) : S(1, "ERROR when calling '.on()': Supplied callback for '" + e + "' is not a valid function!"), d
        }, this.off = function (e, t) {
            return e ? ((e = e.trim().split(" ")).forEach(function (e, n) {
                var r = e.split("."), o = r[0], i = r[1] || "";
                ("*" === o ? Object.keys(y) : [o]).forEach(function (e) {
                    for (var n = y[e] || [], r = n.length; r--;) {
                        var o = n[r];
                        !o || i !== o.namespace && "*" !== i || t && t != o.callback || n.splice(r, 1)
                    }
                    n.length || delete y[e]
                })
            }), d) : (S(1, "ERROR: Invalid event name supplied."), d)
        }, this.trigger = function (t, n) {
            if (t) {
                var r = t.trim().split("."), o = r[0], i = r[1], l = y[o];
                S(3, "event fired:", o, n ? "->" : "", n || ""), l && l.forEach(function (t, r) {
                    i && i !== t.namespace || t.callback.call(d, new e.Event(o, t.namespace, d, n))
                })
            } else S(1, "ERROR: Invalid event name supplied.");
            return d
        }, d.on("change.internal", function (e) {
            "loglevel" !== e.what && "tweenChanges" !== e.what && ("triggerElement" === e.what ? C() : "reverse" === e.what && d.update())
        }).on("shift.internal", function (e) {
            R(), d.update()
        });
        var S = this._log = function (e, t) {
            g.loglevel >= e && (Array.prototype.splice.call(arguments, 1, 0, "(" + s + ") ->"), o.log.apply(window, arguments))
        };
        this.addTo = function (t) {
            return t instanceof e.Controller ? l != t && (l && l.removeScene(d), l = t, O(), T(!0), C(!0), R(), l.info("container").addEventListener("resize", x), t.addScene(d), d.trigger("add", {controller: l}), S(3, "added " + s + " to controller"), d.update()) : S(1, "ERROR: supplied argument of 'addTo()' is not a valid ScrollMagic Controller"), d
        }, this.enabled = function (e) {
            return arguments.length ? (w != e && (w = !!e, d.update(!0)), d) : w
        }, this.remove = function () {
            if (l) {
                l.info("container").removeEventListener("resize", x);
                var e = l;
                l = void 0, e.removeScene(d), d.trigger("remove"), S(3, "removed " + s + " from controller")
            }
            return d
        }, this.destroy = function (e) {
            return d.trigger("destroy", {reset: e}), d.remove(), d.off("*.*"), S(3, "destroyed " + s + " (reset: " + (e ? "true" : "false") + ")"), null
        }, this.update = function (e) {
            if (l) if (e) if (l.enabled() && w) {
                var t, n = l.info("scrollPos");
                t = g.duration > 0 ? (n - v.start) / (v.end - v.start) : n >= v.start ? 1 : 0, d.trigger("update", {
                    startPos: v.start,
                    endPos: v.end,
                    scrollPos: n
                }), d.progress(t)
            } else E && p === c && A(!0); else l.updateScene(d, !1);
            return d
        }, this.refresh = function () {
            return T(), C(), d
        }, this.progress = function (e) {
            if (arguments.length) {
                var t = !1, n = p, r = l ? l.info("scrollDirection") : "PAUSED", o = g.reverse || e >= h;
                if (0 === g.duration ? (t = h != e, p = 0 === (h = e < 1 && o ? 0 : 1) ? a : c) : e < 0 && p !== a && o ? (h = 0, p = a, t = !0) : e >= 0 && e < 1 && o ? (h = e, p = c, t = !0) : e >= 1 && p !== u ? (h = 1, p = u, t = !0) : p !== c || o || A(), t) {
                    var i = {progress: h, state: p, scrollDirection: r}, s = p != n, f = function (e) {
                        d.trigger(e, i)
                    };
                    s && n !== c && (f("enter"), f(n === a ? "start" : "end")), f("progress"), s && p !== c && (f(p === a ? "start" : "end"), f("leave"))
                }
                return d
            }
            return h
        };
        var E, b, R = function () {
            v = {start: m + g.offset}, l && g.triggerElement && (v.start -= l.info("size") * g.triggerHook), v.end = v.start + g.duration
        }, T = function (e) {
            if (i) {
                var t = "duration";
                z(t, i.call(d)) && !e && (d.trigger("change", {what: t, newval: g[t]}), d.trigger("shift", {reason: t}))
            }
        }, C = function (e) {
            var n = 0, r = g.triggerElement;
            if (l && r) {
                for (var i = l.info(), s = o.get.offset(i.container), a = i.vertical ? "top" : "left"; r.parentNode.hasAttribute(t);) r = r.parentNode;
                var c = o.get.offset(r);
                i.isDocument || (s[a] -= l.scrollPos()), n = c[a] - s[a]
            }
            var u = n != m;
            m = n, u && !e && d.trigger("shift", {reason: "triggerElementPosition"})
        }, x = function (e) {
            g.triggerHook > 0 && d.trigger("shift", {reason: "containerResize"})
        }, F = o.extend(r.validate, {
            duration: function (e) {
                if (o.type.String(e) && e.match(/^(\.|\d)*\d+%$/)) {
                    var t = parseFloat(e) / 100;
                    e = function () {
                        return l ? l.info("size") * t : 0
                    }
                }
                if (o.type.Function(e)) {
                    i = e;
                    try {
                        e = parseFloat(i())
                    } catch (t) {
                        e = -1
                    }
                }
                if (e = parseFloat(e), !o.type.Number(e) || e < 0) throw i ? (i = void 0, ['Invalid return value of supplied function for option "duration":', e]) : ['Invalid value for option "duration":', e];
                return e
            }
        }), O = function (e) {
            (e = arguments.length ? [e] : Object.keys(F)).forEach(function (e, t) {
                var n;
                if (F[e]) try {
                    n = F[e](g[e])
                } catch (t) {
                    n = f[e];
                    var r = o.type.String(t) ? [t] : t;
                    o.type.Array(r) ? (r[0] = "ERROR: " + r[0], r.unshift(1), S.apply(this, r)) : S(1, "ERROR: Problem executing validation callback for option '" + e + "':", t.message)
                } finally {
                    g[e] = n
                }
            })
        }, z = function (e, t) {
            var n = !1, r = g[e];
            return g[e] != t && (g[e] = t, O(e), n = r != g[e]), n
        }, P = function (e) {
            d[e] || (d[e] = function (t) {
                return arguments.length ? ("duration" === e && (i = void 0), z(e, t) && (d.trigger("change", {
                    what: e,
                    newval: g[e]
                }), r.shifts.indexOf(e) > -1 && d.trigger("shift", {reason: e})), d) : g[e]
            })
        };
        this.controller = function () {
            return l
        }, this.state = function () {
            return p
        }, this.scrollOffset = function () {
            return v.start
        }, this.triggerPosition = function () {
            var e = g.offset;
            return l && (g.triggerElement ? e += m : e += l.info("size") * d.triggerHook()), e
        }, d.on("shift.internal", function (e) {
            var t = "duration" === e.reason;
            (p === u && t || p === c && 0 === g.duration) && A(), t && L()
        }).on("progress.internal", function (e) {
            A()
        }).on("add.internal", function (e) {
            L()
        }).on("destroy.internal", function (e) {
            d.removePin(e.reset)
        });
        var A = function (e) {
            if (E && l) {
                var t = l.info(), n = b.spacer.firstChild;
                if (e || p !== c) {
                    var r = {position: b.inFlow ? "relative" : "absolute", top: 0, left: 0},
                        i = o.css(n, "position") != r.position;
                    b.pushFollowers ? g.duration > 0 && (p === u && 0 === parseFloat(o.css(b.spacer, "padding-top")) ? i = !0 : p === a && 0 === parseFloat(o.css(b.spacer, "padding-bottom")) && (i = !0)) : r[t.vertical ? "top" : "left"] = g.duration * h, o.css(n, r), i && L()
                } else {
                    "fixed" != o.css(n, "position") && (o.css(n, {position: "fixed"}), L());
                    var s = o.get.offset(b.spacer, !0),
                        f = g.reverse || 0 === g.duration ? t.scrollPos - v.start : Math.round(h * g.duration * 10) / 10;
                    s[t.vertical ? "top" : "left"] += f, o.css(b.spacer.firstChild, {top: s.top, left: s.left})
                }
            }
        }, L = function () {
            if (E && l && b.inFlow) {
                var e = p === c, t = l.info("vertical"), n = b.spacer.firstChild,
                    r = o.isMarginCollapseType(o.css(b.spacer, "display")), i = {};
                b.relSize.width || b.relSize.autoFullWidth ? e ? o.css(E, {width: o.get.width(b.spacer)}) : o.css(E, {width: "100%"}) : (i["min-width"] = o.get.width(t ? E : n, !0, !0), i.width = e ? i["min-width"] : "auto"), b.relSize.height ? e ? o.css(E, {height: o.get.height(b.spacer) - (b.pushFollowers ? g.duration : 0)}) : o.css(E, {height: "100%"}) : (i["min-height"] = o.get.height(t ? n : E, !0, !r), i.height = e ? i["min-height"] : "auto"), b.pushFollowers && (i["padding" + (t ? "Top" : "Left")] = g.duration * h, i["padding" + (t ? "Bottom" : "Right")] = g.duration * (1 - h)), o.css(b.spacer, i)
            }
        }, I = function () {
            l && E && p === c && !l.info("isDocument") && A()
        }, N = function () {
            l && E && p === c && ((b.relSize.width || b.relSize.autoFullWidth) && o.get.width(window) != o.get.width(b.spacer.parentNode) || b.relSize.height && o.get.height(window) != o.get.height(b.spacer.parentNode)) && L()
        }, _ = function (e) {
            l && E && p === c && !l.info("isDocument") && (e.preventDefault(), l._setScrollPos(l.info("scrollPos") - ((e.wheelDelta || e[l.info("vertical") ? "wheelDeltaY" : "wheelDeltaX"]) / 3 || 30 * -e.detail)))
        };
        this.setPin = function (e, n) {
            if (n = o.extend({}, {
                pushFollowers: !0,
                spacerClass: "scrollmagic-pin-spacer"
            }, n), !(e = o.get.elements(e)[0])) return S(1, "ERROR calling method 'setPin()': Invalid pin element supplied."), d;
            if ("fixed" === o.css(e, "position")) return S(1, "ERROR calling method 'setPin()': Pin does not work with elements that are positioned 'fixed'."), d;
            if (E) {
                if (E === e) return d;
                d.removePin()
            }
            var r = (E = e).parentNode.style.display,
                i = ["top", "left", "bottom", "right", "margin", "marginLeft", "marginRight", "marginTop", "marginBottom"];
            E.parentNode.style.display = "none";
            var l = "absolute" != o.css(E, "position"), s = o.css(E, i.concat(["display"])),
                a = o.css(E, ["width", "height"]);
            E.parentNode.style.display = r, !l && n.pushFollowers && (S(2, "WARNING: If the pinned element is positioned absolutely pushFollowers will be disabled."), n.pushFollowers = !1), window.setTimeout(function () {
                E && 0 === g.duration && n.pushFollowers && S(2, "WARNING: pushFollowers =", !0, "has no effect, when scene duration is 0.")
            }, 0);
            var c = E.parentNode.insertBefore(document.createElement("div"), E), u = o.extend(s, {
                position: l ? "relative" : "absolute",
                boxSizing: "content-box",
                mozBoxSizing: "content-box",
                webkitBoxSizing: "content-box"
            });
            if (l || o.extend(u, o.css(E, ["width", "height"])), o.css(c, u), c.setAttribute(t, ""), o.addClass(c, n.spacerClass), b = {
                spacer: c,
                relSize: {
                    width: "%" === a.width.slice(-1),
                    height: "%" === a.height.slice(-1),
                    autoFullWidth: "auto" === a.width && l && o.isMarginCollapseType(s.display)
                },
                pushFollowers: n.pushFollowers,
                inFlow: l
            }, !E.___origStyle) {
                E.___origStyle = {};
                var f = E.style;
                i.concat(["width", "height", "position", "boxSizing", "mozBoxSizing", "webkitBoxSizing"]).forEach(function (e) {
                    E.___origStyle[e] = f[e] || ""
                })
            }
            return b.relSize.width && o.css(c, {width: a.width}), b.relSize.height && o.css(c, {height: a.height}), c.appendChild(E), o.css(E, {
                position: l ? "relative" : "absolute",
                margin: "auto",
                top: "auto",
                left: "auto",
                bottom: "auto",
                right: "auto"
            }), (b.relSize.width || b.relSize.autoFullWidth) && o.css(E, {
                boxSizing: "border-box",
                mozBoxSizing: "border-box",
                webkitBoxSizing: "border-box"
            }), window.addEventListener("scroll", I), window.addEventListener("resize", I), window.addEventListener("resize", N), E.addEventListener("mousewheel", _), E.addEventListener("DOMMouseScroll", _), S(3, "added pin"), A(), d
        }, this.removePin = function (e) {
            if (E) {
                if (p === c && A(!0), e || !l) {
                    var n = b.spacer.firstChild;
                    if (n.hasAttribute(t)) {
                        var r = b.spacer.style;
                        margins = {}, ["margin", "marginLeft", "marginRight", "marginTop", "marginBottom"].forEach(function (e) {
                            margins[e] = r[e] || ""
                        }), o.css(n, margins)
                    }
                    b.spacer.parentNode.insertBefore(n, b.spacer), b.spacer.parentNode.removeChild(b.spacer), E.parentNode.hasAttribute(t) || (o.css(E, E.___origStyle), delete E.___origStyle)
                }
                window.removeEventListener("scroll", I), window.removeEventListener("resize", I), window.removeEventListener("resize", N), E.removeEventListener("mousewheel", _), E.removeEventListener("DOMMouseScroll", _), E = void 0, S(3, "removed pin (reset: " + (e ? "true" : "false") + ")")
            }
            return d
        };
        var M, k = [];
        return d.on("destroy.internal", function (e) {
            d.removeClassToggle(e.reset)
        }), this.setClassToggle = function (e, t) {
            var n = o.get.elements(e);
            return 0 !== n.length && o.type.String(t) ? (k.length > 0 && d.removeClassToggle(), M = t, k = n, d.on("enter.internal_class leave.internal_class", function (e) {
                var t = "enter" === e.type ? o.addClass : o.removeClass;
                k.forEach(function (e, n) {
                    t(e, M)
                })
            }), d) : (S(1, "ERROR calling method 'setClassToggle()': Invalid " + (0 === n.length ? "element" : "classes") + " supplied."), d)
        }, this.removeClassToggle = function (e) {
            return e && k.forEach(function (e, t) {
                o.removeClass(e, M)
            }), d.off("start.internal_class end.internal_class"), M = void 0, k = [], d
        }, function () {
            for (var e in g) f.hasOwnProperty(e) || (S(2, 'WARNING: Unknown option "' + e + '"'), delete g[e]);
            for (var t in f) P(t);
            O()
        }(), d
    };
    var r = {
        defaults: {duration: 0, offset: 0, triggerElement: void 0, triggerHook: .5, reverse: !0, loglevel: 2},
        validate: {
            offset: function (e) {
                if (e = parseFloat(e), !o.type.Number(e)) throw['Invalid value for option "offset":', e];
                return e
            }, triggerElement: function (e) {
                if (e = e || void 0) {
                    var t = o.get.elements(e)[0];
                    if (!t) throw['Element defined in option "triggerElement" was not found:', e];
                    e = t
                }
                return e
            }, triggerHook: function (e) {
                var t = {onCenter: .5, onEnter: 1, onLeave: 0};
                if (o.type.Number(e)) e = Math.max(0, Math.min(parseFloat(e), 1)); else {
                    if (!(e in t)) throw['Invalid value for option "triggerHook": ', e];
                    e = t[e]
                }
                return e
            }, reverse: function (e) {
                return !!e
            }, loglevel: function (e) {
                if (e = parseInt(e), !o.type.Number(e) || e < 0 || e > 3) throw['Invalid value for option "loglevel":', e];
                return e
            }
        },
        shifts: ["duration", "offset", "triggerHook"]
    };
    e.Scene.addOption = function (t, n, o, i) {
        t in r.defaults ? e._util.log(1, "[static] ScrollMagic.Scene -> Cannot add Scene option '" + t + "', because it already exists.") : (r.defaults[t] = n, r.validate[t] = o, i && r.shifts.push(t))
    }, e.Scene.extend = function (t) {
        var n = this;
        e.Scene = function () {
            return n.apply(this, arguments), this.$super = o.extend({}, this), t.apply(this, arguments) || this
        }, o.extend(e.Scene, n), e.Scene.prototype = n.prototype, e.Scene.prototype.constructor = e.Scene
    }, e.Event = function (e, t, n, r) {
        r = r || {};
        for (var o in r) this[o] = r[o];
        return this.type = e, this.target = this.currentTarget = n, this.namespace = t || "", this.timeStamp = this.timestamp = Date.now(), this
    };
    var o = e._util = function (e) {
        var t, n = {}, r = function (e) {
            return parseFloat(e) || 0
        }, o = function (t) {
            return t.currentStyle ? t.currentStyle : e.getComputedStyle(t)
        }, i = function (t, n, i, l) {
            if ((n = n === document ? e : n) === e) l = !1; else if (!p.DomElement(n)) return 0;
            t = t.charAt(0).toUpperCase() + t.substr(1).toLowerCase();
            var s = (i ? n["offset" + t] || n["outer" + t] : n["client" + t] || n["inner" + t]) || 0;
            if (i && l) {
                var a = o(n);
                s += "Height" === t ? r(a.marginTop) + r(a.marginBottom) : r(a.marginLeft) + r(a.marginRight)
            }
            return s
        }, l = function (e) {
            return e.replace(/^[^a-z]+([a-z])/g, "$1").replace(/-([a-z])/g, function (e) {
                return e[1].toUpperCase()
            })
        };
        n.extend = function (e) {
            for (e = e || {}, t = 1; t < arguments.length; t++) if (arguments[t]) for (var n in arguments[t]) arguments[t].hasOwnProperty(n) && (e[n] = arguments[t][n]);
            return e
        }, n.isMarginCollapseType = function (e) {
            return ["block", "flex", "list-item", "table", "-webkit-box"].indexOf(e) > -1
        };
        var s = 0, a = ["ms", "moz", "webkit", "o"], c = e.requestAnimationFrame, u = e.cancelAnimationFrame;
        for (t = 0; !c && t < a.length; ++t) c = e[a[t] + "RequestAnimationFrame"], u = e[a[t] + "CancelAnimationFrame"] || e[a[t] + "CancelRequestAnimationFrame"];
        c || (c = function (t) {
            var n = (new Date).getTime(), r = Math.max(0, 16 - (n - s)), o = e.setTimeout(function () {
                t(n + r)
            }, r);
            return s = n + r, o
        }), u || (u = function (t) {
            e.clearTimeout(t)
        }), n.rAF = c.bind(e), n.cAF = u.bind(e);
        var f = ["error", "warn", "log"], d = e.console || {};
        for (d.log = d.log || function () {
        }, t = 0; t < f.length; t++) {
            var g = f[t];
            d[g] || (d[g] = d.log)
        }
        n.log = function (e) {
            (e > f.length || e <= 0) && (e = f.length);
            var t = new Date,
                n = ("0" + t.getHours()).slice(-2) + ":" + ("0" + t.getMinutes()).slice(-2) + ":" + ("0" + t.getSeconds()).slice(-2) + ":" + ("00" + t.getMilliseconds()).slice(-3),
                r = f[e - 1], o = Array.prototype.splice.call(arguments, 1), i = Function.prototype.bind.call(d[r], d);
            o.unshift(n), i.apply(d, o)
        };
        var p = n.type = function (e) {
            return Object.prototype.toString.call(e).replace(/^\[object (.+)\]$/, "$1").toLowerCase()
        };
        p.String = function (e) {
            return "string" === p(e)
        }, p.Function = function (e) {
            return "function" === p(e)
        }, p.Array = function (e) {
            return Array.isArray(e)
        }, p.Number = function (e) {
            return !p.Array(e) && e - parseFloat(e) + 1 >= 0
        }, p.DomElement = function (e) {
            return "object" == typeof HTMLElement ? e instanceof HTMLElement : e && "object" == typeof e && null !== e && 1 === e.nodeType && "string" == typeof e.nodeName
        };
        var h = n.get = {};
        return h.elements = function (t) {
            var n = [];
            if (p.String(t)) try {
                t = document.querySelectorAll(t)
            } catch (e) {
                return n
            }
            if ("nodelist" === p(t) || p.Array(t)) for (var r = 0, o = n.length = t.length; r < o; r++) {
                var i = t[r];
                n[r] = p.DomElement(i) ? i : h.elements(i)
            } else (p.DomElement(t) || t === document || t === e) && (n = [t]);
            return n
        }, h.scrollTop = function (t) {
            return t && "number" == typeof t.scrollTop ? t.scrollTop : e.pageYOffset || 0
        }, h.scrollLeft = function (t) {
            return t && "number" == typeof t.scrollLeft ? t.scrollLeft : e.pageXOffset || 0
        }, h.width = function (e, t, n) {
            return i("width", e, t, n)
        }, h.height = function (e, t, n) {
            return i("height", e, t, n)
        }, h.offset = function (e, t) {
            var n = {top: 0, left: 0};
            if (e && e.getBoundingClientRect) {
                var r = e.getBoundingClientRect();
                n.top = r.top, n.left = r.left, t || (n.top += h.scrollTop(), n.left += h.scrollLeft())
            }
            return n
        }, n.addClass = function (e, t) {
            t && (e.classList ? e.classList.add(t) : e.className += " " + t)
        }, n.removeClass = function (e, t) {
            t && (e.classList ? e.classList.remove(t) : e.className = e.className.replace(new RegExp("(^|\\b)" + t.split(" ").join("|") + "(\\b|$)", "gi"), " "))
        }, n.css = function (e, t) {
            if (p.String(t)) return o(e)[l(t)];
            if (p.Array(t)) {
                var n = {}, r = o(e);
                return t.forEach(function (e, t) {
                    n[e] = r[l(e)]
                }), n
            }
            for (var i in t) {
                var s = t[i];
                s == parseFloat(s) && (s += "px"), e.style[l(i)] = s
            }
        }, n
    }(window || {});
    return e.Scene.prototype.addIndicators = function () {
        return e._util.log(1, "(ScrollMagic.Scene) -> ERROR calling addIndicators() due to missing Plugin 'debug.addIndicators'. Please make sure to include plugins/debug.addIndicators.js"), this
    }, e.Scene.prototype.removeIndicators = function () {
        return e._util.log(1, "(ScrollMagic.Scene) -> ERROR calling removeIndicators() due to missing Plugin 'debug.addIndicators'. Please make sure to include plugins/debug.addIndicators.js"), this
    }, e.Scene.prototype.setTween = function () {
        return e._util.log(1, "(ScrollMagic.Scene) -> ERROR calling setTween() due to missing Plugin 'animation.gsap'. Please make sure to include plugins/animation.gsap.js"), this
    }, e.Scene.prototype.removeTween = function () {
        return e._util.log(1, "(ScrollMagic.Scene) -> ERROR calling removeTween() due to missing Plugin 'animation.gsap'. Please make sure to include plugins/animation.gsap.js"), this
    }, e.Scene.prototype.setVelocity = function () {
        return e._util.log(1, "(ScrollMagic.Scene) -> ERROR calling setVelocity() due to missing Plugin 'animation.velocity'. Please make sure to include plugins/animation.velocity.js"), this
    }, e.Scene.prototype.removeVelocity = function () {
        return e._util.log(1, "(ScrollMagic.Scene) -> ERROR calling removeVelocity() due to missing Plugin 'animation.velocity'. Please make sure to include plugins/animation.velocity.js"), this
    }, e
});

//ScrollMagic GSAP Animation Plugin
!function (e, n) {
    "function" == typeof define && define.amd ? define(["ScrollMagic", "TweenMax", "TimelineMax"], n) : "object" == typeof exports ? (require("gsap"), n(require("scrollmagic"), TweenMax, TimelineMax)) : n(e.ScrollMagic || e.jQuery && e.jQuery.ScrollMagic, e.TweenMax || e.TweenLite, e.TimelineMax || e.TimelineLite)
}(this, function (e, n, o) {
    "use strict";
    var t = "animation.gsap", r = window.console || {},
        i = Function.prototype.bind.call(r.error || r.log || function () {
        }, r);
    e || i("(" + t + ") -> ERROR: The ScrollMagic main module could not be found. Please make sure it's loaded before this plugin or use an asynchronous loader like requirejs."), n || i("(" + t + ") -> ERROR: TweenLite or TweenMax could not be found. Please make sure GSAP is loaded before ScrollMagic or use an asynchronous loader like requirejs."), e.Scene.addOption("tweenChanges", !1, function (e) {
        return !!e
    }), e.Scene.extend(function () {
        var e, r = this, i = function () {
            r._log && (Array.prototype.splice.call(arguments, 1, 0, "(" + t + ")", "->"), r._log.apply(this, arguments))
        };
        r.on("progress.plugin_gsap", function () {
            a()
        }), r.on("destroy.plugin_gsap", function (e) {
            r.removeTween(e.reset)
        });
        var a = function () {
            if (e) {
                var n = r.progress(), o = r.state();
                e.repeat && -1 === e.repeat() ? "DURING" === o && e.paused() ? e.play() : "DURING" === o || e.paused() || e.pause() : n != e.progress() && (0 === r.duration() ? n > 0 ? e.play() : e.reverse() : r.tweenChanges() && e.tweenTo ? e.tweenTo(n * e.duration()) : e.progress(n).pause())
            }
        };
        r.setTween = function (t, l, s) {
            var c;
            arguments.length > 1 && (arguments.length < 3 && (s = l, l = 1), t = n.to(t, l, s));
            try {
                (c = o ? new o({smoothChildTiming: !0}).add(t) : t).pause()
            } catch (e) {
                return i(1, "ERROR calling method 'setTween()': Supplied argument is not a valid TweenObject"), r
            }
            if (e && r.removeTween(), e = c, t.repeat && -1 === t.repeat() && (e.repeat(-1), e.yoyo(t.yoyo())), r.tweenChanges() && !e.tweenTo && i(2, "WARNING: tweenChanges will only work if the TimelineMax object is available for ScrollMagic."), e && r.controller() && r.triggerElement() && r.loglevel() >= 2) {
                var u = n.getTweensOf(r.triggerElement()), p = r.controller().info("vertical");
                u.forEach(function (e, n) {
                    var o = e.vars.css || e.vars;
                    if (p ? void 0 !== o.top || void 0 !== o.bottom : void 0 !== o.left || void 0 !== o.right) return i(2, "WARNING: Tweening the position of the trigger element affects the scene timing and should be avoided!"), !1
                })
            }
            if (parseFloat(TweenLite.version) >= 1.14) for (var d, g, f = e.getChildren ? e.getChildren(!0, !0, !1) : [e], w = function () {
                i(2, "WARNING: tween was overwritten by another. To learn how to avoid this issue see here: https://github.com/janpaepke/ScrollMagic/wiki/WARNING:-tween-was-overwritten-by-another")
            }, h = 0; h < f.length; h++) d = f[h], g !== w && (g = d.vars.onOverwrite, d.vars.onOverwrite = function () {
                g && g.apply(this, arguments), w.apply(this, arguments)
            });
            return i(3, "added tween"), a(), r
        }, r.removeTween = function (n) {
            return e && (n && e.progress(0).pause(), e.kill(), e = void 0, i(3, "removed tween (reset: " + (n ? "true" : "false") + ")")), r
        }
    })
});

//JavaScript Cookie v2.2.0 https://github.com/js-cookie/js-cookie
!function (e) {
    var n;
    if ("function" == typeof define && define.amd && (define(e), n = !0), "object" == typeof exports && (module.exports = e(), n = !0), !n) {
        var t = window.Cookies, o = window.Cookies = e();
        o.noConflict = function () {
            return window.Cookies = t, o
        }
    }
}(function () {
    function e() {
        for (var e = 0, n = {}; e < arguments.length; e++) {
            var t = arguments[e];
            for (var o in t) n[o] = t[o]
        }
        return n
    }

    function n(e) {
        return e.replace(/(%[0-9A-Z]{2})+/g, decodeURIComponent)
    }

    return function t(o) {
        function r() {
        }

        function i(n, t, i) {
            if ("undefined" != typeof document) {
                "number" == typeof (i = e({path: "/"}, r.defaults, i)).expires && (i.expires = new Date(1 * new Date + 864e5 * i.expires)), i.expires = i.expires ? i.expires.toUTCString() : "";
                try {
                    var c = JSON.stringify(t);
                    /^[\{\[]/.test(c) && (t = c)
                } catch (e) {
                }
                t = o.write ? o.write(t, n) : encodeURIComponent(String(t)).replace(/%(23|24|26|2B|3A|3C|3E|3D|2F|3F|40|5B|5D|5E|60|7B|7D|7C)/g, decodeURIComponent), n = encodeURIComponent(String(n)).replace(/%(23|24|26|2B|5E|60|7C)/g, decodeURIComponent).replace(/[\(\)]/g, escape);
                var f = "";
                for (var u in i) i[u] && (f += "; " + u, !0 !== i[u] && (f += "=" + i[u].split(";")[0]));
                return document.cookie = n + "=" + t + f
            }
        }

        function c(e, t) {
            if ("undefined" != typeof document) {
                for (var r = {}, i = document.cookie ? document.cookie.split("; ") : [], c = 0; c < i.length; c++) {
                    var f = i[c].split("="), u = f.slice(1).join("=");
                    t || '"' !== u.charAt(0) || (u = u.slice(1, -1));
                    try {
                        var a = n(f[0]);
                        if (u = (o.read || o)(u, a) || n(u), t) try {
                            u = JSON.parse(u)
                        } catch (e) {
                        }
                        if (r[a] = u, e === a) break
                    } catch (e) {
                    }
                }
                return e ? r[e] : r
            }
        }

        return r.set = i, r.get = function (e) {
            return c(e, !1)
        }, r.getJSON = function (e) {
            return c(e, !0)
        }, r.remove = function (n, t) {
            i(n, "", e(t, {expires: -1}))
        }, r.defaults = {}, r.withConverter = t, r
    }(function () {
    })
});

//ImagesLoaded PACKAGED v4.1.4
!function (e, t) {
    "function" == typeof define && define.amd ? define("ev-emitter/ev-emitter", t) : "object" == typeof module && module.exports ? module.exports = t() : e.EvEmitter = t()
}("undefined" != typeof window ? window : this, function () {
    function e() {
    }

    var t = e.prototype;
    return t.on = function (e, t) {
        if (e && t) {
            var i = this._events = this._events || {}, n = i[e] = i[e] || [];
            return n.indexOf(t) == -1 && n.push(t), this
        }
    }, t.once = function (e, t) {
        if (e && t) {
            this.on(e, t);
            var i = this._onceEvents = this._onceEvents || {}, n = i[e] = i[e] || {};
            return n[t] = !0, this
        }
    }, t.off = function (e, t) {
        var i = this._events && this._events[e];
        if (i && i.length) {
            var n = i.indexOf(t);
            return n != -1 && i.splice(n, 1), this
        }
    }, t.emitEvent = function (e, t) {
        var i = this._events && this._events[e];
        if (i && i.length) {
            i = i.slice(0), t = t || [];
            for (var n = this._onceEvents && this._onceEvents[e], o = 0; o < i.length; o++) {
                var r = i[o], s = n && n[r];
                s && (this.off(e, r), delete n[r]), r.apply(this, t)
            }
            return this
        }
    }, t.allOff = function () {
        delete this._events, delete this._onceEvents
    }, e
}), function (e, t) {
    "use strict";
    "function" == typeof define && define.amd ? define(["ev-emitter/ev-emitter"], function (i) {
        return t(e, i)
    }) : "object" == typeof module && module.exports ? module.exports = t(e, require("ev-emitter")) : e.imagesLoaded = t(e, e.EvEmitter)
}("undefined" != typeof window ? window : this, function (e, t) {
    function i(e, t) {
        for (var i in t) e[i] = t[i];
        return e
    }

    function n(e) {
        if (Array.isArray(e)) return e;
        var t = "object" == typeof e && "number" == typeof e.length;
        return t ? d.call(e) : [e]
    }

    function o(e, t, r) {
        if (!(this instanceof o)) return new o(e, t, r);
        var s = e;
        return "string" == typeof e && (s = document.querySelectorAll(e)), s ? (this.elements = n(s), this.options = i({}, this.options), "function" == typeof t ? r = t : i(this.options, t), r && this.on("always", r), this.getImages(), h && (this.jqDeferred = new h.Deferred), void setTimeout(this.check.bind(this))) : void a.error("Bad element for imagesLoaded " + (s || e))
    }

    function r(e) {
        this.img = e
    }

    function s(e, t) {
        this.url = e, this.element = t, this.img = new Image
    }

    var h = e.jQuery, a = e.console, d = Array.prototype.slice;
    o.prototype = Object.create(t.prototype), o.prototype.options = {}, o.prototype.getImages = function () {
        this.images = [], this.elements.forEach(this.addElementImages, this)
    }, o.prototype.addElementImages = function (e) {
        "IMG" == e.nodeName && this.addImage(e), this.options.background === !0 && this.addElementBackgroundImages(e);
        var t = e.nodeType;
        if (t && u[t]) {
            for (var i = e.querySelectorAll("img"), n = 0; n < i.length; n++) {
                var o = i[n];
                this.addImage(o)
            }
            if ("string" == typeof this.options.background) {
                var r = e.querySelectorAll(this.options.background);
                for (n = 0; n < r.length; n++) {
                    var s = r[n];
                    this.addElementBackgroundImages(s)
                }
            }
        }
    };
    var u = {1: !0, 9: !0, 11: !0};
    return o.prototype.addElementBackgroundImages = function (e) {
        var t = getComputedStyle(e);
        if (t) for (var i = /url\((['"])?(.*?)\1\)/gi, n = i.exec(t.backgroundImage); null !== n;) {
            var o = n && n[2];
            o && this.addBackground(o, e), n = i.exec(t.backgroundImage)
        }
    }, o.prototype.addImage = function (e) {
        var t = new r(e);
        this.images.push(t)
    }, o.prototype.addBackground = function (e, t) {
        var i = new s(e, t);
        this.images.push(i)
    }, o.prototype.check = function () {
        function e(e, i, n) {
            setTimeout(function () {
                t.progress(e, i, n)
            })
        }

        var t = this;
        return this.progressedCount = 0, this.hasAnyBroken = !1, this.images.length ? void this.images.forEach(function (t) {
            t.once("progress", e), t.check()
        }) : void this.complete()
    }, o.prototype.progress = function (e, t, i) {
        this.progressedCount++, this.hasAnyBroken = this.hasAnyBroken || !e.isLoaded, this.emitEvent("progress", [this, e, t]), this.jqDeferred && this.jqDeferred.notify && this.jqDeferred.notify(this, e), this.progressedCount == this.images.length && this.complete(), this.options.debug && a && a.log("progress: " + i, e, t)
    }, o.prototype.complete = function () {
        var e = this.hasAnyBroken ? "fail" : "done";
        if (this.isComplete = !0, this.emitEvent(e, [this]), this.emitEvent("always", [this]), this.jqDeferred) {
            var t = this.hasAnyBroken ? "reject" : "resolve";
            this.jqDeferred[t](this)
        }
    }, r.prototype = Object.create(t.prototype), r.prototype.check = function () {
        var e = this.getIsImageComplete();
        return e ? void this.confirm(0 !== this.img.naturalWidth, "naturalWidth") : (this.proxyImage = new Image, this.proxyImage.addEventListener("load", this), this.proxyImage.addEventListener("error", this), this.img.addEventListener("load", this), this.img.addEventListener("error", this), void (this.proxyImage.src = this.img.src))
    }, r.prototype.getIsImageComplete = function () {
        return this.img.complete && this.img.naturalWidth
    }, r.prototype.confirm = function (e, t) {
        this.isLoaded = e, this.emitEvent("progress", [this, this.img, t])
    }, r.prototype.handleEvent = function (e) {
        var t = "on" + e.type;
        this[t] && this[t](e)
    }, r.prototype.onload = function () {
        this.confirm(!0, "onload"), this.unbindEvents()
    }, r.prototype.onerror = function () {
        this.confirm(!1, "onerror"), this.unbindEvents()
    }, r.prototype.unbindEvents = function () {
        this.proxyImage.removeEventListener("load", this), this.proxyImage.removeEventListener("error", this), this.img.removeEventListener("load", this), this.img.removeEventListener("error", this)
    }, s.prototype = Object.create(r.prototype), s.prototype.check = function () {
        this.img.addEventListener("load", this), this.img.addEventListener("error", this), this.img.src = this.url;
        var e = this.getIsImageComplete();
        e && (this.confirm(0 !== this.img.naturalWidth, "naturalWidth"), this.unbindEvents())
    }, s.prototype.unbindEvents = function () {
        this.img.removeEventListener("load", this), this.img.removeEventListener("error", this)
    }, s.prototype.confirm = function (e, t) {
        this.isLoaded = e, this.emitEvent("progress", [this, this.element, t])
    }, o.makeJQueryPlugin = function (t) {
        t = t || e.jQuery, t && (h = t, h.fn.imagesLoaded = function (e, t) {
            var i = new o(this, e, t);
            return i.jqDeferred.promise(h(this))
        })
    }, o.makeJQueryPlugin(), o
});

//Masked Input plugin Version: 1.3.1
!function (e) {
    var t, n, a,
        r = (n = document.createElement("input"), a = "onpaste", n.setAttribute(a, ""), ("function" == typeof n[a] ? "paste" : "input") + ".mask"),
        i = navigator.userAgent, o = /iphone/i.test(i), c = /android/i.test(i);
    e.mask = {
        definitions: {9: "[0-9]", a: "[A-Za-z]", "*": "[A-Za-z0-9]"},
        dataName: "rawMaskFn",
        placeholder: "_"
    }, e.fn.extend({
        caret: function (e, t) {
            var n;
            if (0 !== this.length && !this.is(":hidden")) return "number" == typeof e ? (t = "number" == typeof t ? t : e, this.each(function () {
                this.setSelectionRange ? this.setSelectionRange(e, t) : this.createTextRange && ((n = this.createTextRange()).collapse(!0), n.moveEnd("character", t), n.moveStart("character", e), n.select())
            })) : (this[0].setSelectionRange ? (e = this[0].selectionStart, t = this[0].selectionEnd) : document.selection && document.selection.createRange && (n = document.selection.createRange(), e = 0 - n.duplicate().moveStart("character", -1e5), t = e + n.text.length), {
                begin: e,
                end: t
            })
        }, unmask: function () {
            return this.trigger("unmask")
        }, mask: function (n, a) {
            var i, l, s, u, f;
            return !n && this.length > 0 ? e(this[0]).data(e.mask.dataName)() : (a = e.extend({
                placeholder: e.mask.placeholder,
                completed: null
            }, a), i = e.mask.definitions, l = [], s = f = n.length, u = null, e.each(n.split(""), function (e, t) {
                "?" == t ? (f--, s = e) : i[t] ? (l.push(RegExp(i[t])), null === u && (u = l.length - 1)) : l.push(null)
            }), this.trigger("unmask").each(function () {
                function h(e) {
                    for (; f > ++e && !l[e];) ;
                    return e
                }

                function d(e, t) {
                    var n, r;
                    if (!(0 > e)) {
                        for (n = e, r = h(t); f > n; n++) if (l[n]) {
                            if (!(f > r && l[n].test(k[r]))) break;
                            k[n] = k[r], k[r] = a.placeholder, r = h(r)
                        }
                        p(), v.caret(Math.max(u, e))
                    }
                }

                function m(e, t) {
                    var n;
                    for (n = e; t > n && f > n; n++) l[n] && (k[n] = a.placeholder)
                }

                function p() {
                    v.val(k.join(""))
                }

                function g(e) {
                    var t, n, r = v.val(), i = -1;
                    for (t = 0, pos = 0; f > t; t++) if (l[t]) {
                        for (k[t] = a.placeholder; pos++ < r.length;) if (n = r.charAt(pos - 1), l[t].test(n)) {
                            k[t] = n, i = t;
                            break
                        }
                        if (pos > r.length) break
                    } else k[t] === r.charAt(pos) && t !== s && (pos++, i = t);
                    return e ? p() : s > i + 1 ? (v.val(""), m(0, f)) : (p(), v.val(v.val().substring(0, i + 1))), s ? t : u
                }

                var v = e(this), k = e.map(n.split(""), function (e) {
                    return "?" != e ? i[e] ? a.placeholder : e : void 0
                }), b = v.val();
                v.data(e.mask.dataName, function () {
                    return e.map(k, function (e, t) {
                        return l[t] && e != a.placeholder ? e : null
                    }).join("")
                }), v.attr("readonly") || v.one("unmask", function () {
                    v.unbind(".mask").removeData(e.mask.dataName)
                }).bind("focus.mask", function () {
                    var e;
                    clearTimeout(t), b = v.val(), e = g(), t = setTimeout(function () {
                        p(), e == n.length ? v.caret(0, e) : v.caret(e)
                    }, 10)
                }).bind("blur.mask", function () {
                    g(), v.val() != b && v.change()
                }).bind("keydown.mask", function (e) {
                    var t, n, a, r = e.which;
                    8 === r || 46 === r || o && 127 === r ? (n = (t = v.caret()).begin, 0 == (a = t.end) - n && (n = 46 !== r ? function (e) {
                        for (; --e >= 0 && !l[e];) ;
                        return e
                    }(n) : a = h(n - 1), a = 46 === r ? h(a) : a), m(n, a), d(n, a - 1), e.preventDefault()) : 27 == r && (v.val(b), v.caret(0, g()), e.preventDefault())
                }).bind("keypress.mask", function (t) {
                    var n, r, i, o = t.which, s = v.caret();
                    t.ctrlKey || t.altKey || t.metaKey || 32 > o || o && (0 != s.end - s.begin && (m(s.begin, s.end), d(s.begin, s.end - 1)), n = h(s.begin - 1), f > n && (r = String.fromCharCode(o), l[n].test(r) && (function (e) {
                        var t, n, r, i;
                        for (t = e, n = a.placeholder; f > t; t++) if (l[t]) {
                            if (r = h(t), i = k[t], k[t] = n, !(f > r && l[r].test(i))) break;
                            n = i
                        }
                    }(n), k[n] = r, p(), i = h(n), c ? setTimeout(e.proxy(e.fn.caret, v, i), 0) : v.caret(i), a.completed && i >= f && a.completed.call(v))), t.preventDefault())
                }).bind(r, function () {
                    setTimeout(function () {
                        var e = g(!0);
                        v.caret(e), a.completed && e == v.val().length && a.completed.call(v)
                    }, 0)
                }), g()
            }))
        }
    })
}(jQuery);

//Date picker
"use strict";
!function (t, e) {
    var a = e(t), i = e("body"), s = e("html"), n = "jquery-datepicker", d = function (t, a) {
        var i, n = e(t);
        a = e.isPlainObject(a) ? a : {}, i = {
            options: e.extend({}, d.prototype.DEFAULTS, a),
            isMobile: s.hasClass("mobile"),
            $elem: n,
            $input: n.find(".datepicker"),
            $panel: null,
            selectedDate: null,
            displayMonth: null,
            isCreated: !1,
            isShown: !1,
            isDateSelected: "none" !== a.date
        }, e.extend(this, i), this.init()
    };
    d.prototype = {
        constructor: d,
        DEFAULTS: {
            lang: document.getElementsByTagName("html")[0].getAttribute("lang"),
            date: null,
            startDate: null,
            endDate: null,
            disabledDates: [],
            format: "ddmmyy",
            position: "below"
        },
        msg: {
            "uk-UA": {
                months: ["Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень", "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень"],
                days: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"]
            },
            "ru-RU": {
                months: ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"],
                days: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
            },
            "en-US": {
                months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
                days: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
            },
            "en-EN": {
                months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
                days: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
            }
        },
        init: function () {
            this.initDateObj(), this.$input.attr("readonly", "readonly"), this.isDateSelected && this.updateInputfield(this.formatDateStr(this.selectedDate)), !0 === this.isMobile && (this.$container = e("<div>").addClass("datepicker-container").appendTo(i)), this.updateView(this.selectedDate), !0 === this.isMobile ? this.$container.addClass("datepicker-hidden") : this.$panel.addClass("datepicker-hidden"), this.attachToInput(), this.isCreated = !0
        },
        initDateObj: function () {
            this.selectedDate = this.getDateObj(this.options.date),
            this.options.startDate && (this.startDate = this.getDateObj(this.options.startDate)),
            this.options.endDate && (this.endDate = this.getDateObj(this.options.endDate))
        },
        updateView: function (t) {
            var a, i, s;
            a = this.getHeader(this.msg[this.options.lang], t),
                i = this.getContent(this.msg[this.options.lang], t),
                s = e("<table>").addClass("datepicker-table").append(a, i), this.isCreated ? this.$panel.empty().append(s) : this.$panel = e("<div>").addClass("datepicker-panel").append(s),
                this.isMobile ? this.$panel.addClass("datepicker-mobile").appendTo(this.$container) : this.$panel.appendTo(this.$elem),
                this.adjustPanelPosition(),
                this.displayMonth = new Date(t.getTime()), this.registerEventHandlers()
        },
        getHeader: function (t, a) {
            var i, s, n, d, l, o;
            return i = a.getFullYear(), s = a.getMonth(), n = e("<th>").addClass("datepicker-prev").append(e('<span><svg viewBox="0 0 18 18"><path d="M11.56 5.56L10.5 4.5 6 9l4.5 4.5 1.06-1.06L8.12 9z"></path></svg></span>')), d = e("<th>").addClass("datepicker-next").append(e('<span><svg viewBox="0 0 18 18"><path d="M7.5 4.5L6.44 5.56 9.88 9l-3.44 3.44L7.5 13.5 12 9z"></path></svg></span>')), l = e("<th>").attr("colspan", "5").addClass("datepicker-title").append(e("<span>").text(t.months[s] + " " + i)), o = e("<thead>"), e("<tr>").append(n, l, d).appendTo(o), o
        },
        getContent: function (t, a) {
            var i, s, n, d, l, o, h = [];
            for (i = a.getFullYear(), s = a.getMonth(), n = e("<tr>"), t.days.forEach(function (t) {
                n.append(e("<td>").addClass("datepicker-day-name").append(e("<span>").text(t)))
            }), 0 === (d = new Date(i, s, 1).getDay()) && (d = 7), l = 0; l < d - 1; l++) h.push(e("<td>").addClass("date-disabled").append("<span>"));
            for (l = 1; l <= this.getDaysOfMonth(s + 1, i); l++) o = e("<td>").addClass("datepicker-day").append(e("<span>").text(l)), this.isDateSelected && this.selectedDate.getFullYear() === i && this.selectedDate.getMonth() === s && this.selectedDate.getDate() === l && o.addClass("datepicker-selected"), this.startDate && this.startDate.getTime() > new Date(i, s, l).getTime() && o.addClass("date-disabled"), this.endDate && this.endDate.getTime() < new Date(i, s, l).getTime() && o.addClass("date-disabled"), h.push(o);
            for (l = 0; l < h.length; l += 7) n = n.add(e("<tr>").append(h.slice(l, l + 7)));
            return n
        },
        getDaysOfMonth: function (t, e) {
            return new Date(e, t, 0).getDate()
        },
        getDateObj: function (t) {
            var e, a, i, s, n;
            if (this.isDateSelected && t && "string" == typeof t) if ("+" === (s = t.charAt(0)) || "-" === s) switch (n = parseInt(t.slice(1, -1), 10), i = new Date, e = new Date(i.getFullYear(), i.getMonth(), i.getDate()), isNaN(n) && (n = 0), s) {
                case"-":
                    e.setDate(e.getDate() - n);
                    break;
                case"+":
                default:
                    e.setDate(e.getDate() + n)
            } else a = t.split("-"), e = new Date(a[0], parseInt(a[1], 10) - 1, a[2]); else i = new Date, e = new Date(i.getFullYear(), i.getMonth(), i.getDate());
            return e
        },
        formatDateStr: function (t) {
            var e, a, i, s, n;
            switch (e = (t.getFullYear() + "").slice(-2), a = t.getFullYear() + "", i = ("0" + (t.getMonth() + 1)).slice(-2), s = ("0" + t.getDate()).slice(-2), this.options.format) {
                case"yyyymmdd":
                    n = a + "/" + i + "/" + s;
                    break;
                case"mmddyyyy":
                    n = i + "/" + s + "/" + a;
                    break;
                case"ddmmyyyy":
                    n = s + "/" + i + "/" + a;
                    break;
                case"yymmdd":
                    n = e + "/" + i + "/" + s;
                    break;
                case"mmddyy":
                    n = i + "/" + s + "/" + e;
                    break;
                case"ddmmyy":
                default:
                    n = s + "/" + i + "/" + e
            }
            return n
        },
        registerEventHandlers: function () {
            var t = this, a = this.$panel.find(".datepicker-prev"), i = this.$panel.find(".datepicker-next"),
                s = this.$panel.find("table td");
            a.on("click", function (e) {
                e.stopPropagation(), t.displayMonth = new Date(t.displayMonth.getFullYear(), t.displayMonth.getMonth() - 1, 1), t.updateView(t.displayMonth)
            }), i.on("click", function (e) {
                e.stopPropagation(), t.displayMonth = new Date(t.displayMonth.getFullYear(), t.displayMonth.getMonth() + 1, 1), t.updateView(t.displayMonth)
            }), s.on("click", function (a) {
                var i = e(this);
                if (a.stopPropagation(), i.hasClass("date-disabled") || i.hasClass("datepicker-day-name")) return !1;
                t.$panel.find(".datepicker-selected").removeClass("datepicker-selected"), i.addClass("datepicker-selected"), t.selectedDate = t.getDateObj(t.displayMonth.getFullYear() + "-" + (t.displayMonth.getMonth() + 1) + "-" + i.find("span").text()), t.updateInputfield(t.formatDateStr(t.selectedDate)), t.isDateSelected = !0, t.hide()
            })
        },
        attachToInput: function () {
            var t = this;
            this.$input.on("click", function () {
                t.$input.blur(), !1 === t.isShown && t.show()
            })
        },
        updateInputfield: function (t) {
            this.$input.val(t).trigger("change")
        },
        adjustPanelPosition: function () {
            var t = this.$input.offset();
            !0 === this.isMobile ? this.$panel.width(this.$panel.find("table").width()) : "below" === this.options.position ? this.$panel.addClass("datepicker-below").removeClass("-position--above") : (this.$panel.addClass("-position--above").removeClass("datepicker-below"), this.$panel.css({
                bottom: a.height() - t.top,
                left: t.left
            })), this.$panel.height(this.$panel.find("table").height())
        },
        show: function () {
            var t = this;
            a.click(function (e) {
                t.$input.is(e.target) || t.$panel.is(e.target) || 0 !== t.$panel.has(e.target).length || t.hide()
            }), this.isMobile ? this.$container.fadeIn(250, function () {
                i.css("cursor", "pointer"), t.$container.removeClass("datepicker-hidden")
            }) : this.$panel.fadeIn(250, function () {
                t.$panel.removeClass("datepicker-hidden")
            }), this.adjustPanelPosition(), this.isShown = !0
        },
        hide: function () {
            var t = this;
            this.isMobile ? this.$container.fadeOut(250, function () {
                i.css("cursor", ""), t.$container.addClass("datepicker-hidden")
            }) : this.$panel.fadeOut(250, function () {
                t.$panel.addClass("datepicker-hidden")
            }), this.isShown = !1
        },
        get: function () {
            return this.isDateSelected ? this.selectedDate : null
        },
        set: function (t) {
            null === t ? (this.isDateSelected = !1, this.selectedDate = this.getDateObj(), this.updateView(this.selectedDate), this.updateInputfield("")) : (this.isDateSelected = !0, this.selectedDate = t, this.updateView(this.selectedDate), this.updateInputfield(this.formatDateStr(this.selectedDate)))
        }
    }, e.fn.datepicker = function (t) {
        var a, i = Array.prototype.slice.call(arguments);
        return this.each(function () {
            var s, l, o = e(this), h = o.data(n);
            l = {
                date: o.attr("data-selected-date"),
                startDate: o.attr("data-start-date"),
                endDate: o.attr("data-end-date"),
                format: o.attr("data-format")
            }, h || o.data(n, h = new d(this, e.extend({}, l, t))), "string" == typeof t && "function" == typeof (s = h[t]) && (a = s.apply(h, i.slice(1)))
        }), void 0 === a ? this : a
    }, e.fn.datepicker.Constructor = d
}(window, jQuery);

//Async scroll Paroller
!function (r) {
    "use strict";
    "object" == typeof module && "object" == typeof module.exports ? module.exports = r(require("jquery")) : r(jQuery)
}(function (r) {
    "use strict";
    var t = !1, o = function () {
        t = !1
    }, n = {
        bgVertical: function (r, t) {
            return r.css({"background-position": "center " + -t + "px"})
        }, bgHorizontal: function (r, t) {
            return r.css({"background-position": -t + "px center"})
        }, vertical: function (r, t, o) {
            return "none" !== o || (o = ""), r.css({
                "-webkit-transform": "translateY(" + t + "px)" + o,
                "-moz-transform": "translateY(" + t + "px)" + o,
                transform: "translateY(" + t + "px)" + o,
                transition: "transform linear",
                "will-change": "transform"
            })
        }, horizontal: function (r, t, o) {
            return "none" !== o || (o = ""), r.css({
                "-webkit-transform": "translateX(" + t + "px)" + o,
                "-moz-transform": "translateX(" + t + "px)" + o,
                transform: "translateX(" + t + "px)" + o,
                transition: "transform linear",
                "will-change": "transform"
            })
        }
    }, a = {
        factor: function (r, t, o) {
            var n = r.data("paroller-factor"), a = n || o.factor;
            if (t < 576) {
                var e = r.data("paroller-factor-xs"), i = e || o.factorXs;
                return i || a
            }
            if (t <= 768) {
                var c = r.data("paroller-factor-sm"), f = c || o.factorSm;
                return f || a
            }
            if (t <= 1024) {
                var l = r.data("paroller-factor-md"), u = l || o.factorMd;
                return u || a
            }
            if (t <= 1200) {
                var s = r.data("paroller-factor-lg"), d = s || o.factorLg;
                return d || a
            }
            if (t <= 1920) {
                var g = r.data("paroller-factor-xl"), h = g || o.factorXl;
                return h || a
            }
            return a
        }, bgOffset: function (r, t) {
            return Math.round(r * t)
        }, transform: function (r, t, o, n) {
            return Math.round((r - o / 2 + n) * t)
        }
    }, e = {
        background: function (r) {
            return r.css({"background-position": "unset"})
        }, foreground: function (r) {
            return r.css({transform: "unset", transition: "unset"})
        }
    };
    r.fn.paroller = function (i) {
        var c = r(window).height(), f = r(document).height(), i = r.extend({
            factor: 0,
            factorXs: 0,
            factorSm: 0,
            factorMd: 0,
            factorLg: 0,
            factorXl: 0,
            type: "background",
            direction: "vertical"
        }, i);
        return this.each(function () {
            var l = r(this), u = r(window).width(), s = l.offset().top, d = l.outerHeight(),
                g = l.data("paroller-type"), h = l.data("paroller-direction"), p = l.css("transform"), m = g || i.type,
                b = h || i.direction, v = a.factor(l, u, i), w = a.bgOffset(s, v), z = a.transform(s, v, c, d);
            "background" === m ? "vertical" === b ? n.bgVertical(l, w) : "horizontal" === b && n.bgHorizontal(l, w) : "foreground" === m && ("vertical" === b ? n.vertical(l, z, p) : "horizontal" === b && n.horizontal(l, z, p)), r(window).on("resize", function () {
                var g = r(this).scrollTop();
                u = r(window).width(), s = l.offset().top, d = l.outerHeight(), v = a.factor(l, u, i), w = Math.round(s * v), z = Math.round((s - c / 2 + d) * v), t || (window.requestAnimationFrame(o), t = !0), "background" === m ? (e.background(l), "vertical" === b ? n.bgVertical(l, w) : "horizontal" === b && n.bgHorizontal(l, w)) : "foreground" === m && g <= f && (e.foreground(l), "vertical" === b ? n.vertical(l, z) : "horizontal" === b && n.horizontal(l, z))
            }), r(window).on("scroll", function () {
                var a = r(this).scrollTop();
                f = r(document).height(), w = Math.round((s - a) * v), z = Math.round((s - c / 2 + d - a) * v), t || (window.requestAnimationFrame(o), t = !0), "background" === m ? "vertical" === b ? n.bgVertical(l, w) : "horizontal" === b && n.bgHorizontal(l, w) : "foreground" === m && a <= f && ("vertical" === b ? n.vertical(l, z, p) : "horizontal" === b && n.horizontal(l, z, p))
            })
        })
    }
});

//In viewport
!function (e, n) {
    "object" == typeof exports && "undefined" != typeof module ? n(require("jquery"), require("window")) : "function" == typeof define && define.amd ? define("isInViewport", ["jquery", "window"], n) : n(e.$, e.window)
}(this, function (e, n) {
    "use strict";

    function t(o, r) {
        var i = o.getBoundingClientRect(), a = i.top, u = i.bottom, c = i.left, f = i.right,
            l = e.extend({tolerance: 0, viewport: n}, r), d = !1, s = l.viewport.jquery ? l.viewport : e(l.viewport);
        s.length || (console.warn("isInViewport: The viewport selector you have provided matches no element on page."), console.warn("isInViewport: Defaulting to viewport as window"), s = e(n));
        var p = s.height(), w = s.width(), h = s[0].toString();
        if (s[0] !== n && "[object Window]" !== h && "[object DOMWindow]" !== h) {
            var v = s[0].getBoundingClientRect();
            a -= v.top, u -= v.top, c -= v.left, f -= v.left, t.scrollBarWidth = t.scrollBarWidth || function (n) {
                var t = e("<div></div>").css({width: "100%"});
                n.append(t);
                var o = n.width() - t.width();
                return t.remove(), o
            }(s), w -= t.scrollBarWidth
        }
        return l.tolerance = ~~Math.round(parseFloat(l.tolerance)), l.tolerance < 0 && (l.tolerance = p + l.tolerance), f <= 0 || c >= w ? d : d = l.tolerance ? a <= l.tolerance && u >= l.tolerance : u > 0 && a <= p
    }

    function o(n) {
        if (n) {
            var t = n.split(",");
            return 1 === t.length && isNaN(t[0]) && (t[1] = t[0], t[0] = void 0), {
                tolerance: t[0] ? t[0].trim() : void 0,
                viewport: t[1] ? e(t[1].trim()) : void 0
            }
        }
        return {}
    }

    e = "default" in e ? e.default : e, n = "default" in n ? n.default : n, e.extend(e.expr[":"], {
        "in-viewport": e.expr.createPseudo ? e.expr.createPseudo(function (e) {
            return function (n) {
                return t(n, o(e))
            }
        }) : function (e, n, r) {
            return t(e, o(r[3]))
        }
    }), e.fn.isInViewport = function (e) {
        return this.filter(function (n, o) {
            return t(o, e)
        })
    }, e.fn.run = function (n) {
        var t = this;
        if (1 === arguments.length && "function" == typeof n && (n = [n]), !(n instanceof Array)) throw new SyntaxError("isInViewport: Argument(s) passed to .do/.run should be a function or an array of functions");
        return n.forEach(function (n) {
            "function" != typeof n ? (console.warn("isInViewport: Argument(s) passed to .do/.run should be a function or an array of functions"), console.warn("isInViewport: Ignoring non-function values in array and moving on")) : [].slice.call(t).forEach(function (t) {
                return n.call(e(t))
            })
        }), this
    }
});

//Jquery history
"object" != typeof JSON && (JSON = {}), function () {
    "use strict";

    function f(e) {
        return 10 > e ? "0" + e : e
    }

    function quote(e) {
        return escapable.lastIndex = 0, escapable.test(e) ? '"' + e.replace(escapable, function (e) {
            var t = meta[e];
            return "string" == typeof t ? t : "\\u" + ("0000" + e.charCodeAt(0).toString(16)).slice(-4)
        }) + '"' : '"' + e + '"'
    }

    function str(e, t) {
        var a, r, n, o, s, i = gap, u = t[e];
        switch (u && "object" == typeof u && "function" == typeof u.toJSON && (u = u.toJSON(e)), "function" == typeof rep && (u = rep.call(t, e, u)), typeof u) {
            case"string":
                return quote(u);
            case"number":
                return isFinite(u) ? String(u) : "null";
            case"boolean":
            case"null":
                return String(u);
            case"object":
                if (!u) return "null";
                if (gap += indent, s = [], "[object Array]" === Object.prototype.toString.apply(u)) {
                    for (o = u.length, a = 0; o > a; a += 1) s[a] = str(a, u) || "null";
                    return n = 0 === s.length ? "[]" : gap ? "[\n" + gap + s.join(",\n" + gap) + "\n" + i + "]" : "[" + s.join(",") + "]", gap = i, n
                }
                if (rep && "object" == typeof rep) for (o = rep.length, a = 0; o > a; a += 1) "string" == typeof rep[a] && (r = rep[a], n = str(r, u), n && s.push(quote(r) + (gap ? ": " : ":") + n)); else for (r in u) Object.prototype.hasOwnProperty.call(u, r) && (n = str(r, u), n && s.push(quote(r) + (gap ? ": " : ":") + n));
                return n = 0 === s.length ? "{}" : gap ? "{\n" + gap + s.join(",\n" + gap) + "\n" + i + "}" : "{" + s.join(",") + "}", gap = i, n
        }
    }

    "function" != typeof Date.prototype.toJSON && (Date.prototype.toJSON = function (e) {
        return isFinite(this.valueOf()) ? this.getUTCFullYear() + "-" + f(this.getUTCMonth() + 1) + "-" + f(this.getUTCDate()) + "T" + f(this.getUTCHours()) + ":" + f(this.getUTCMinutes()) + ":" + f(this.getUTCSeconds()) + "Z" : null
    }, String.prototype.toJSON = Number.prototype.toJSON = Boolean.prototype.toJSON = function (e) {
        return this.valueOf()
    });
    var cx = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
        escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
        gap, indent,
        meta = {"\b": "\\b", "	": "\\t", "\n": "\\n", "\f": "\\f", "\r": "\\r", '"': '\\"', "\\": "\\\\"}, rep;
    "function" != typeof JSON.stringify && (JSON.stringify = function (e, t, a) {
        var r;
        if (gap = "", indent = "", "number" == typeof a) for (r = 0; a > r; r += 1) indent += " "; else "string" == typeof a && (indent = a);
        if (rep = t, !t || "function" == typeof t || "object" == typeof t && "number" == typeof t.length) return str("", {"": e});
        throw new Error("JSON.stringify")
    }), "function" != typeof JSON.parse && (JSON.parse = function (text, reviver) {
        function walk(e, t) {
            var a, r, n = e[t];
            if (n && "object" == typeof n) for (a in n) Object.prototype.hasOwnProperty.call(n, a) && (r = walk(n, a), void 0 !== r ? n[a] = r : delete n[a]);
            return reviver.call(e, t, n)
        }

        var j;
        if (text = String(text), cx.lastIndex = 0, cx.test(text) && (text = text.replace(cx, function (e) {
            return "\\u" + ("0000" + e.charCodeAt(0).toString(16)).slice(-4)
        })), /^[\],:{}\s]*$/.test(text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, "@").replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, "]").replace(/(?:^|:|,)(?:\s*\[)+/g, ""))) return j = eval("(" + text + ")"), "function" == typeof reviver ? walk({"": j}, "") : j;
        throw new SyntaxError("JSON.parse")
    })
}(), function (e, t) {
    "use strict";
    var a = e.History = e.History || {}, r = e.jQuery;
    if ("undefined" != typeof a.Adapter) throw new Error("History.js Adapter has already been loaded...");
    a.Adapter = {
        bind: function (e, t, a) {
            r(e).bind(t, a)
        }, trigger: function (e, t, a) {
            r(e).trigger(t, a)
        }, extractEventData: function (e, a, r) {
            var n = a && a.originalEvent && a.originalEvent[e] || r && r[e] || t;
            return n
        }, onDomLoad: function (e) {
            r(e)
        }
    }, "undefined" != typeof a.init && a.init()
}(window), function (e, t) {
    "use strict";
    var a = e.document, r = e.setTimeout || r, n = e.clearTimeout || n, o = e.setInterval || o,
        s = e.History = e.History || {};
    if ("undefined" != typeof s.initHtml4) throw new Error("History.js HTML4 Support has already been loaded...");
    s.initHtml4 = function () {
        return "undefined" != typeof s.initHtml4.initialized ? !1 : (s.initHtml4.initialized = !0, s.enabled = !0, s.savedHashes = [], s.isLastHash = function (e) {
            var t, a = s.getHashByIndex();
            return t = e === a
        }, s.isHashEqual = function (e, t) {
            return e = encodeURIComponent(e).replace(/%25/g, "%"), t = encodeURIComponent(t).replace(/%25/g, "%"), e === t
        }, s.saveHash = function (e) {
            return s.isLastHash(e) ? !1 : (s.savedHashes.push(e), !0)
        }, s.getHashByIndex = function (e) {
            var t = null;
            return t = "undefined" == typeof e ? s.savedHashes[s.savedHashes.length - 1] : 0 > e ? s.savedHashes[s.savedHashes.length + e] : s.savedHashes[e]
        }, s.discardedHashes = {}, s.discardedStates = {}, s.discardState = function (e, t, a) {
            var r, n = s.getHashByState(e);
            return r = {discardedState: e, backState: a, forwardState: t}, s.discardedStates[n] = r, !0
        }, s.discardHash = function (e, t, a) {
            var r = {discardedHash: e, backState: a, forwardState: t};
            return s.discardedHashes[e] = r, !0
        }, s.discardedState = function (e) {
            var t, a = s.getHashByState(e);
            return t = s.discardedStates[a] || !1
        }, s.discardedHash = function (e) {
            var t = s.discardedHashes[e] || !1;
            return t
        }, s.recycleState = function (e) {
            var t = s.getHashByState(e);
            return s.discardedState(e) && delete s.discardedStates[t], !0
        }, s.emulated.hashChange && (s.hashChangeInit = function () {
            s.checkerFunction = null;
            var t, r, n, i, u = "", l = Boolean(s.getHash());
            return s.isInternetExplorer() ? (t = "historyjs-iframe", r = a.createElement("iframe"), r.setAttribute("id", t), r.setAttribute("src", "#"), r.style.display = "none", a.body.appendChild(r), r.contentWindow.document.open(), r.contentWindow.document.close(), n = "", i = !1, s.checkerFunction = function () {
                if (i) return !1;
                i = !0;
                var t = s.getHash(), a = s.getHash(r.contentWindow.document);
                return t !== u ? (u = t, a !== t && (n = a = t, r.contentWindow.document.open(), r.contentWindow.document.close(), r.contentWindow.document.location.hash = s.escapeHash(t)), s.Adapter.trigger(e, "hashchange")) : a !== n && (n = a, l && "" === a ? s.back() : s.setHash(a, !1)), i = !1, !0
            }) : s.checkerFunction = function () {
                var t = s.getHash() || "";
                return t !== u && (u = t, s.Adapter.trigger(e, "hashchange")), !0
            }, s.intervalList.push(o(s.checkerFunction, s.options.hashChangeInterval)), !0
        }, s.Adapter.onDomLoad(s.hashChangeInit)), s.emulated.pushState && (s.onHashChange = function (t) {
            var a, r = t && t.newURL || s.getLocationHref(), n = s.getHashByUrl(r), o = null, i = null;
            return s.isLastHash(n) ? (s.busy(!1), !1) : (s.doubleCheckComplete(), s.saveHash(n), n && s.isTraditionalAnchor(n) ? (s.Adapter.trigger(e, "anchorchange"), s.busy(!1), !1) : (o = s.extractState(s.getFullUrl(n || s.getLocationHref()), !0), s.isLastSavedState(o) ? (s.busy(!1), !1) : (i = s.getHashByState(o), a = s.discardedState(o), a ? (s.getHashByIndex(-2) === s.getHashByState(a.forwardState) ? s.back(!1) : s.forward(!1), !1) : (s.pushState(o.data, o.title, encodeURI(o.url), !1), !0))))
        }, s.Adapter.bind(e, "hashchange", s.onHashChange), s.pushState = function (t, a, r, n) {
            if (r = encodeURI(r).replace(/%25/g, "%"), s.getHashByUrl(r)) throw new Error("History.js does not support states with fragment-identifiers (hashes/anchors).");
            if (n !== !1 && s.busy()) return s.pushQueue({
                scope: s,
                callback: s.pushState,
                args: arguments,
                queue: n
            }), !1;
            s.busy(!0);
            var o = s.createStateObject(t, a, r), i = s.getHashByState(o), u = s.getState(!1), l = s.getHashByState(u),
                c = s.getHash(), d = s.expectedStateId == o.id;
            return s.storeState(o), s.expectedStateId = o.id, s.recycleState(o), s.setTitle(o), i === l ? (s.busy(!1), !1) : (s.saveState(o), d || s.Adapter.trigger(e, "statechange"), !s.isHashEqual(i, c) && !s.isHashEqual(i, s.getShortUrl(s.getLocationHref())) && s.setHash(i, !1), s.busy(!1), !0)
        }, s.replaceState = function (t, a, r, n) {
            if (r = encodeURI(r).replace(/%25/g, "%"), s.getHashByUrl(r)) throw new Error("History.js does not support states with fragment-identifiers (hashes/anchors).");
            if (n !== !1 && s.busy()) return s.pushQueue({
                scope: s,
                callback: s.replaceState,
                args: arguments,
                queue: n
            }), !1;
            s.busy(!0);
            var o = s.createStateObject(t, a, r), i = s.getHashByState(o), u = s.getState(!1), l = s.getHashByState(u),
                c = s.getStateByIndex(-2);
            return s.discardState(u, o, c), i === l ? (s.storeState(o), s.expectedStateId = o.id, s.recycleState(o), s.setTitle(o), s.saveState(o), s.Adapter.trigger(e, "statechange"), s.busy(!1)) : s.pushState(o.data, o.title, o.url, !1), !0
        }), s.emulated.pushState && s.getHash() && !s.emulated.hashChange && s.Adapter.onDomLoad(function () {
            s.Adapter.trigger(e, "hashchange")
        }), void 0)
    }, "undefined" != typeof s.init && s.init()
}(window), function (e, t) {
    "use strict";
    var a = e.console || t, r = e.document, n = e.navigator, o = !1, s = e.setTimeout, i = e.clearTimeout,
        u = e.setInterval, l = e.clearInterval, c = e.JSON, d = e.alert, p = e.History = e.History || {}, f = e.history;
    try {
        o = e.sessionStorage, o.setItem("TEST", "1"), o.removeItem("TEST")
    } catch (h) {
        o = !1
    }
    if (c.stringify = c.stringify || c.encode, c.parse = c.parse || c.decode, "undefined" != typeof p.init) throw new Error("History.js Core has already been loaded...");
    p.init = function (e) {
        return "undefined" == typeof p.Adapter ? !1 : ("undefined" != typeof p.initCore && p.initCore(), "undefined" != typeof p.initHtml4 && p.initHtml4(), !0)
    }, p.initCore = function (h) {
        if ("undefined" != typeof p.initCore.initialized) return !1;
        if (p.initCore.initialized = !0, p.options = p.options || {}, p.options.hashChangeInterval = p.options.hashChangeInterval || 100, p.options.safariPollInterval = p.options.safariPollInterval || 500, p.options.doubleCheckInterval = p.options.doubleCheckInterval || 500, p.options.disableSuid = p.options.disableSuid || !1, p.options.storeInterval = p.options.storeInterval || 1e3, p.options.busyDelay = p.options.busyDelay || 250, p.options.debug = p.options.debug || !1, p.options.initialTitle = p.options.initialTitle || r.title, p.options.html4Mode = p.options.html4Mode || !1, p.options.delayInit = p.options.delayInit || !1, p.intervalList = [], p.clearAllIntervals = function () {
            var e, t = p.intervalList;
            if ("undefined" != typeof t && null !== t) {
                for (e = 0; e < t.length; e++) l(t[e]);
                p.intervalList = null
            }
        }, p.debug = function () {
            (p.options.debug || !1) && p.log.apply(p, arguments)
        }, p.log = function () {
            var e, t, n, o, s,
                i = "undefined" != typeof a && "undefined" != typeof a.log && "undefined" != typeof a.log.apply,
                u = r.getElementById("log");
            for (i ? (o = Array.prototype.slice.call(arguments), e = o.shift(), "undefined" != typeof a.debug ? a.debug.apply(a, [e, o]) : a.log.apply(a, [e, o])) : e = "\n" + arguments[0] + "\n", t = 1, n = arguments.length; n > t; ++t) {
                if (s = arguments[t], "object" == typeof s && "undefined" != typeof c) try {
                    s = c.stringify(s)
                } catch (l) {
                }
                e += "\n" + s + "\n"
            }
            return u ? (u.value += e + "\n-----\n", u.scrollTop = u.scrollHeight - u.clientHeight) : i || d(e), !0
        }, p.getInternetExplorerMajorVersion = function () {
            var e = p.getInternetExplorerMajorVersion.cached = "undefined" != typeof p.getInternetExplorerMajorVersion.cached ? p.getInternetExplorerMajorVersion.cached : function () {
                for (var e = 3, t = r.createElement("div"), a = t.getElementsByTagName("i"); (t.innerHTML = "<!--[if gt IE " + ++e + "]><i></i><![endif]-->") && a[0];) ;
                return e > 4 ? e : !1
            }();
            return e
        }, p.isInternetExplorer = function () {
            var e = p.isInternetExplorer.cached = "undefined" != typeof p.isInternetExplorer.cached ? p.isInternetExplorer.cached : Boolean(p.getInternetExplorerMajorVersion());
            return e
        }, p.options.html4Mode ? p.emulated = {
            pushState: !0,
            hashChange: !0
        } : p.emulated = {
            pushState: !Boolean(e.history && e.history.pushState && e.history.replaceState && !/ Mobile\/([1-7][a-z]|(8([abcde]|f(1[0-8]))))/i.test(n.userAgent) && !/AppleWebKit\/5([0-2]|3[0-2])/i.test(n.userAgent)),
            hashChange: Boolean(!("onhashchange" in e || "onhashchange" in r) || p.isInternetExplorer() && p.getInternetExplorerMajorVersion() < 8)
        }, p.enabled = !p.emulated.pushState, p.bugs = {
            setHash: Boolean(!p.emulated.pushState && "Apple Computer, Inc." === n.vendor && /AppleWebKit\/5([0-2]|3[0-3])/.test(n.userAgent)),
            safariPoll: Boolean(!p.emulated.pushState && "Apple Computer, Inc." === n.vendor && /AppleWebKit\/5([0-2]|3[0-3])/.test(n.userAgent)),
            ieDoubleCheck: Boolean(p.isInternetExplorer() && p.getInternetExplorerMajorVersion() < 8),
            hashEscape: Boolean(p.isInternetExplorer() && p.getInternetExplorerMajorVersion() < 7)
        }, p.isEmptyObject = function (e) {
            for (var t in e) if (e.hasOwnProperty(t)) return !1;
            return !0
        }, p.cloneObject = function (e) {
            var t, a;
            return e ? (t = c.stringify(e), a = c.parse(t)) : a = {}, a
        }, p.getRootUrl = function () {
            var e = r.location.protocol + "//" + (r.location.hostname || r.location.host);
            return r.location.port && (e += ":" + r.location.port), e += "/"
        }, p.getBaseHref = function () {
            var e = r.getElementsByTagName("base"), t = null, a = "";
            return 1 === e.length && (t = e[0], a = t.href.replace(/[^\/]+$/, "")), a = a.replace(/\/+$/, ""), a && (a += "/"), a
        }, p.getBaseUrl = function () {
            var e = p.getBaseHref() || p.getBasePageUrl() || p.getRootUrl();
            return e
        }, p.getPageUrl = function () {
            var e, t = p.getState(!1, !1), a = (t || {}).url || p.getLocationHref();
            return e = a.replace(/\/+$/, "").replace(/[^\/]+$/, function (e, t, a) {
                return /\./.test(e) ? e : e + "/"
            })
        }, p.getBasePageUrl = function () {
            var e = p.getLocationHref().replace(/[#\?].*/, "").replace(/[^\/]+$/, function (e, t, a) {
                return /[^\/]$/.test(e) ? "" : e
            }).replace(/\/+$/, "") + "/";
            return e
        }, p.getFullUrl = function (e, t) {
            var a = e, r = e.substring(0, 1);
            return t = "undefined" == typeof t ? !0 : t, /[a-z]+\:\/\//.test(e) || (a = "/" === r ? p.getRootUrl() + e.replace(/^\/+/, "") : "#" === r ? p.getPageUrl().replace(/#.*/, "") + e : "?" === r ? p.getPageUrl().replace(/[\?#].*/, "") + e : t ? p.getBaseUrl() + e.replace(/^(\.\/)+/, "") : p.getBasePageUrl() + e.replace(/^(\.\/)+/, "")), a.replace(/\#$/, "")
        }, p.getShortUrl = function (e) {
            var t = e, a = p.getBaseUrl(), r = p.getRootUrl();
            return p.emulated.pushState && (t = t.replace(a, "")), t = t.replace(r, "/"), p.isTraditionalAnchor(t) && (t = "./" + t), t = t.replace(/^(\.\/)+/g, "./").replace(/\#$/, "")
        }, p.getLocationHref = function (e) {
            return e = e || r, e.URL === e.location.href ? e.location.href : e.location.href === decodeURIComponent(e.URL) ? e.URL : e.location.hash && decodeURIComponent(e.location.href.replace(/^[^#]+/, "")) === e.location.hash ? e.location.href : -1 == e.URL.indexOf("#") && -1 != e.location.href.indexOf("#") ? e.location.href : e.URL || e.location.href
        }, p.store = {}, p.idToState = p.idToState || {}, p.stateToId = p.stateToId || {}, p.urlToId = p.urlToId || {}, p.storedStates = p.storedStates || [], p.savedStates = p.savedStates || [], p.normalizeStore = function () {
            p.store.idToState = p.store.idToState || {}, p.store.urlToId = p.store.urlToId || {}, p.store.stateToId = p.store.stateToId || {}
        }, p.getState = function (e, t) {
            "undefined" == typeof e && (e = !0), "undefined" == typeof t && (t = !0);
            var a = p.getLastSavedState();
            return !a && t && (a = p.createStateObject()), e && (a = p.cloneObject(a), a.url = a.cleanUrl || a.url), a
        }, p.getIdByState = function (e) {
            var t, a = p.extractId(e.url);
            if (!a) if (t = p.getStateString(e), "undefined" != typeof p.stateToId[t]) a = p.stateToId[t]; else if ("undefined" != typeof p.store.stateToId[t]) a = p.store.stateToId[t]; else {
                for (; a = (new Date).getTime() + String(Math.random()).replace(/\D/g, ""), "undefined" != typeof p.idToState[a] || "undefined" != typeof p.store.idToState[a];) ;
                p.stateToId[t] = a, p.idToState[a] = e
            }
            return a
        }, p.normalizeState = function (e) {
            var t, a;
            return e && "object" == typeof e || (e = {}), "undefined" != typeof e.normalized ? e : (e.data && "object" == typeof e.data || (e.data = {}), t = {}, t.normalized = !0, t.title = e.title || "", t.url = p.getFullUrl(e.url ? e.url : p.getLocationHref()), t.hash = p.getShortUrl(t.url), t.data = p.cloneObject(e.data), t.id = p.getIdByState(t), t.cleanUrl = t.url.replace(/\??\&_suid.*/, ""), t.url = t.cleanUrl, a = !p.isEmptyObject(t.data), (t.title || a) && p.options.disableSuid !== !0 && (t.hash = p.getShortUrl(t.url).replace(/\??\&_suid.*/, ""), /\?/.test(t.hash) || (t.hash += "?"), t.hash += "&_suid=" + t.id), t.hashedUrl = p.getFullUrl(t.hash), (p.emulated.pushState || p.bugs.safariPoll) && p.hasUrlDuplicate(t) && (t.url = t.hashedUrl), t)
        }, p.createStateObject = function (e, t, a) {
            var r = {data: e, title: t, url: a};
            return r = p.normalizeState(r)
        }, p.getStateById = function (e) {
            e = String(e);
            var a = p.idToState[e] || p.store.idToState[e] || t;
            return a
        }, p.getStateString = function (e) {
            var t, a, r;
            return t = p.normalizeState(e), a = {data: t.data, title: e.title, url: e.url}, r = c.stringify(a)
        }, p.getStateId = function (e) {
            var t, a;
            return t = p.normalizeState(e), a = t.id
        }, p.getHashByState = function (e) {
            var t, a;
            return t = p.normalizeState(e), a = t.hash
        }, p.extractId = function (e) {
            var t, a, r, n;
            return n = -1 != e.indexOf("#") ? e.split("#")[0] : e, a = /(.*)\&_suid=([0-9]+)$/.exec(n), r = a ? a[1] || e : e, t = a ? String(a[2] || "") : "", t || !1
        }, p.isTraditionalAnchor = function (e) {
            var t = !/[\/\?\.]/.test(e);
            return t
        }, p.extractState = function (e, t) {
            var a, r, n = null;
            return t = t || !1, a = p.extractId(e), a && (n = p.getStateById(a)), n || (r = p.getFullUrl(e), a = p.getIdByUrl(r) || !1, a && (n = p.getStateById(a)), !n && t && !p.isTraditionalAnchor(e) && (n = p.createStateObject(null, null, r))), n
        }, p.getIdByUrl = function (e) {
            var a = p.urlToId[e] || p.store.urlToId[e] || t;
            return a
        }, p.getLastSavedState = function () {
            return p.savedStates[p.savedStates.length - 1] || t
        }, p.getLastStoredState = function () {
            return p.storedStates[p.storedStates.length - 1] || t
        }, p.hasUrlDuplicate = function (e) {
            var t, a = !1;
            return t = p.extractState(e.url), a = t && t.id !== e.id
        }, p.storeState = function (e) {
            return p.urlToId[e.url] = e.id, p.storedStates.push(p.cloneObject(e)), e
        }, p.isLastSavedState = function (e) {
            var t, a, r, n = !1;
            return p.savedStates.length && (t = e.id, a = p.getLastSavedState(), r = a.id, n = t === r), n
        }, p.saveState = function (e) {
            return p.isLastSavedState(e) ? !1 : (p.savedStates.push(p.cloneObject(e)), !0)
        }, p.getStateByIndex = function (e) {
            var t = null;
            return t = "undefined" == typeof e ? p.savedStates[p.savedStates.length - 1] : 0 > e ? p.savedStates[p.savedStates.length + e] : p.savedStates[e]
        }, p.getCurrentIndex = function () {
            var e = null;
            return e = p.savedStates.length < 1 ? 0 : p.savedStates.length - 1
        }, p.getHash = function (e) {
            var t, a = p.getLocationHref(e);
            return t = p.getHashByUrl(a)
        }, p.unescapeHash = function (e) {
            var t = p.normalizeHash(e);
            return t = decodeURIComponent(t)
        }, p.normalizeHash = function (e) {
            var t = e.replace(/[^#]*#/, "").replace(/#.*/, "");
            return t
        }, p.setHash = function (e, t) {
            var a, n;
            return t !== !1 && p.busy() ? (p.pushQueue({
                scope: p,
                callback: p.setHash,
                args: arguments,
                queue: t
            }), !1) : (p.busy(!0), a = p.extractState(e, !0), a && !p.emulated.pushState ? p.pushState(a.data, a.title, a.url, !1) : p.getHash() !== e && (p.bugs.setHash ? (n = p.getPageUrl(), p.pushState(null, null, n + "#" + e, !1)) : r.location.hash = e), p)
        }, p.escapeHash = function (t) {
            var a = p.normalizeHash(t);
            return a = e.encodeURIComponent(a), p.bugs.hashEscape || (a = a.replace(/\%21/g, "!").replace(/\%26/g, "&").replace(/\%3D/g, "=").replace(/\%3F/g, "?")), a
        }, p.getHashByUrl = function (e) {
            var t = String(e).replace(/([^#]*)#?([^#]*)#?(.*)/, "$2");
            return t = p.unescapeHash(t)
        }, p.setTitle = function (e) {
            var t, a = e.title;
            a || (t = p.getStateByIndex(0), t && t.url === e.url && (a = t.title || p.options.initialTitle));
            try {
                r.getElementsByTagName("title")[0].innerHTML = a.replace("<", "&lt;").replace(">", "&gt;").replace(" & ", " &amp; ")
            } catch (n) {
            }
            return r.title = a, p
        }, p.queues = [], p.busy = function (e) {
            if ("undefined" != typeof e ? p.busy.flag = e : "undefined" == typeof p.busy.flag && (p.busy.flag = !1), !p.busy.flag) {
                i(p.busy.timeout);
                var t = function () {
                    var e, a, r;
                    if (!p.busy.flag) for (e = p.queues.length - 1; e >= 0; --e) a = p.queues[e], 0 !== a.length && (r = a.shift(), p.fireQueueItem(r), p.busy.timeout = s(t, p.options.busyDelay))
                };
                p.busy.timeout = s(t, p.options.busyDelay)
            }
            return p.busy.flag
        }, p.busy.flag = !1, p.fireQueueItem = function (e) {
            return e.callback.apply(e.scope || p, e.args || [])
        }, p.pushQueue = function (e) {
            return p.queues[e.queue || 0] = p.queues[e.queue || 0] || [], p.queues[e.queue || 0].push(e), p
        }, p.queue = function (e, t) {
            return "function" == typeof e && (e = {callback: e}), "undefined" != typeof t && (e.queue = t), p.busy() ? p.pushQueue(e) : p.fireQueueItem(e), p
        }, p.clearQueue = function () {
            return p.busy.flag = !1, p.queues = [], p
        }, p.stateChanged = !1, p.doubleChecker = !1, p.doubleCheckComplete = function () {
            return p.stateChanged = !0, p.doubleCheckClear(), p
        }, p.doubleCheckClear = function () {
            return p.doubleChecker && (i(p.doubleChecker), p.doubleChecker = !1), p
        }, p.doubleCheck = function (e) {
            return p.stateChanged = !1, p.doubleCheckClear(), p.bugs.ieDoubleCheck && (p.doubleChecker = s(function () {
                return p.doubleCheckClear(), p.stateChanged || e(), !0
            }, p.options.doubleCheckInterval)), p
        }, p.safariStatePoll = function () {
            var t, a = p.extractState(p.getLocationHref());
            return p.isLastSavedState(a) ? void 0 : (t = a, t || (t = p.createStateObject()), p.Adapter.trigger(e, "popstate"), p)
        }, p.back = function (e) {
            return e !== !1 && p.busy() ? (p.pushQueue({
                scope: p,
                callback: p.back,
                args: arguments,
                queue: e
            }), !1) : (p.busy(!0), p.doubleCheck(function () {
                p.back(!1)
            }), f.go(-1), !0)
        }, p.forward = function (e) {
            return e !== !1 && p.busy() ? (p.pushQueue({
                scope: p,
                callback: p.forward,
                args: arguments,
                queue: e
            }), !1) : (p.busy(!0), p.doubleCheck(function () {
                p.forward(!1)
            }), f.go(1), !0)
        }, p.go = function (e, t) {
            var a;
            if (e > 0) for (a = 1; e >= a; ++a) p.forward(t); else {
                if (!(0 > e)) throw new Error("History.go: History.go requires a positive or negative integer passed.");
                for (a = -1; a >= e; --a) p.back(t)
            }
            return p
        }, p.emulated.pushState) {
            var g = function () {
            };
            p.pushState = p.pushState || g, p.replaceState = p.replaceState || g
        } else p.onPopState = function (t, a) {
            var r, n, o = !1, s = !1;
            return p.doubleCheckComplete(), r = p.getHash(), r ? (n = p.extractState(r || p.getLocationHref(), !0), n ? p.replaceState(n.data, n.title, n.url, !1) : (p.Adapter.trigger(e, "anchorchange"), p.busy(!1)), p.expectedStateId = !1, !1) : (o = p.Adapter.extractEventData("state", t, a) || !1, s = o ? p.getStateById(o) : p.expectedStateId ? p.getStateById(p.expectedStateId) : p.extractState(p.getLocationHref()), s || (s = p.createStateObject(null, null, p.getLocationHref())), p.expectedStateId = !1, p.isLastSavedState(s) ? (p.busy(!1), !1) : (p.storeState(s), p.saveState(s), p.setTitle(s), p.Adapter.trigger(e, "statechange"), p.busy(!1), !0))
        }, p.Adapter.bind(e, "popstate", p.onPopState), p.pushState = function (t, a, r, n) {
            if (p.getHashByUrl(r) && p.emulated.pushState) throw new Error("History.js does not support states with fragement-identifiers (hashes/anchors).");
            if (n !== !1 && p.busy()) return p.pushQueue({
                scope: p,
                callback: p.pushState,
                args: arguments,
                queue: n
            }), !1;
            p.busy(!0);
            var o = p.createStateObject(t, a, r);
            return p.isLastSavedState(o) ? p.busy(!1) : (p.storeState(o), p.expectedStateId = o.id, f.pushState(o.id, o.title, o.url), p.Adapter.trigger(e, "popstate")), !0
        }, p.replaceState = function (t, a, r, n) {
            if (p.getHashByUrl(r) && p.emulated.pushState) throw new Error("History.js does not support states with fragement-identifiers (hashes/anchors).");
            if (n !== !1 && p.busy()) return p.pushQueue({
                scope: p,
                callback: p.replaceState,
                args: arguments,
                queue: n
            }), !1;
            p.busy(!0);
            var o = p.createStateObject(t, a, r);
            return p.isLastSavedState(o) ? p.busy(!1) : (p.storeState(o), p.expectedStateId = o.id, f.replaceState(o.id, o.title, o.url), p.Adapter.trigger(e, "popstate")), !0
        };
        if (o) {
            try {
                p.store = c.parse(o.getItem("History.store")) || {}
            } catch (S) {
                p.store = {}
            }
            p.normalizeStore()
        } else p.store = {}, p.normalizeStore();
        p.Adapter.bind(e, "unload", p.clearAllIntervals), p.saveState(p.storeState(p.extractState(p.getLocationHref(), !0))), o && (p.onUnload = function () {
            var e, t, a;
            try {
                e = c.parse(o.getItem("History.store")) || {}
            } catch (r) {
                e = {}
            }
            e.idToState = e.idToState || {}, e.urlToId = e.urlToId || {}, e.stateToId = e.stateToId || {};
            for (t in p.idToState) p.idToState.hasOwnProperty(t) && (e.idToState[t] = p.idToState[t]);
            for (t in p.urlToId) p.urlToId.hasOwnProperty(t) && (e.urlToId[t] = p.urlToId[t]);
            for (t in p.stateToId) p.stateToId.hasOwnProperty(t) && (e.stateToId[t] = p.stateToId[t]);
            p.store = e, p.normalizeStore(), a = c.stringify(e);
            try {
                o.setItem("History.store", a)
            } catch (n) {
                if (n.code !== DOMException.QUOTA_EXCEEDED_ERR) throw n;
                o.length && (o.removeItem("History.store"), o.setItem("History.store", a))
            }
        }, p.intervalList.push(u(p.onUnload, p.options.storeInterval)), p.Adapter.bind(e, "beforeunload", p.onUnload), p.Adapter.bind(e, "unload", p.onUnload)), p.emulated.pushState || (p.bugs.safariPoll && p.intervalList.push(u(p.safariStatePoll, p.options.safariPollInterval)), ("Apple Computer, Inc." === n.vendor || "Mozilla" === (n.appCodeName || "")) && (p.Adapter.bind(e, "hashchange", function () {
            p.Adapter.trigger(e, "popstate")
        }), p.getHash() && p.Adapter.onDomLoad(function () {
            p.Adapter.trigger(e, "hashchange")
        })))
    }, (!p.options || !p.options.delayInit) && p.init()
}(window);

//Infinity scroll
!function (t) {
    t.fn.pantrif_infinite_scroll = function (e) {
        var o, a = t.extend({
                ajax_method: "method_load_more_button",
                selector_next: ".next",
                selector_prev: ".prev",
                enable_history: "on",
                start_loading_x_from_end: "0",
                wrapper_pagination: "#ajax-post-pagination",
                wrapper_products: "#ajax-load-post"
            }, e), r = t(a.wrapper_products), i = r.height(), n = "", l = 0, s = 0, d = a.wrapper_pagination, p = [],
            c = t("title").text(), f = window.location.href, u = !1, _ = !1;
        t("#reviews-section").length && (o = !0);
        var w = r.offset().top, h = w + r.height(), g = {
            init: function () {
                void 0 !== t("#ajax-post-pagination .next").attr("href") && t("#article-load-more").show(), void 0 !== t("#ajax-post-pagination .prev").attr("href") && t("#article-load-less").show();
                var e = {scrollTop: r.offset().top, title: c, url: f};
                p.push([s++, e]), v.updatePage(), t("body").on("click", "#isw-load-more-button", function () {
                    t(this).addClass("pulser-animate"), setTimeout(function () {
                        v.products_loop()
                    }, 1400)
                }), t("body").on("click", "#isw-load-more-button-prev", function () {
                    t(this).addClass("pulser-animate"), setTimeout(function () {
                        v.products_loop("", !0)
                    }, 1400)
                }), t(v.element).scroll(function (t) {
                    r.length > 0 && (v.isScrolledToBottom(a.wrapper_products) && !u && (u = !0), v.isScrolledToTop(a.wrapper_products) && !_ && (_ = !0))
                })
            }, updatePage: function () {
                t(v.element).scroll(function (e) {
                    var o = t(window).scrollTop(), a = v.closest(o, p);
                    if(!!$("#ajax-load-post").data("no-url")) {
                        w < o && h > o && History.replaceState({}, a.title, null)
                    }else{
                        w < o && h > o && History.replaceState({}, a.title, a.url)
                    }
                })
            }, closest: function (t, e) {
                for (var o = e[0][1].scrollTop, a = e[0][1], r = Math.abs(t - o), i = 0; i < e.length; i++) {
                    var n = Math.abs(t - e[i][1].scrollTop);
                    n < r && (r = n, o = e[i][1].scrollTop, a = e[i][1])
                }
                return a
            }, isScrolledIntoPage: function (e) {
                var o = t(window).scrollTop(), a = o + t(window).height(), r = t(e).offset().top;
                return r + t(e).height() <= a && r >= o
            }, addPreviousPage: function (t) {
                p.unshift([0, t]), s++;
                for (var e = 1, o = p.length; e < o; e++) p[e][0] = p[e][0] + 1, p[e][1].scrollTop = p[e][1].scrollTop + i
            }, addNextPage: function (t) {
                p.push([s++, t])
            }, products_loop: function (e, i, s) {
                if (void 0 === i && (i = !1), void 0 === s && (s = !0), void 0 === e || "" === e) e = i ? t("#ajax-post-pagination .prev").attr("href") : t("#ajax-post-pagination .next").attr("href");
                i ? _ = !0 : u = !0, void 0 !== e && ("function" == typeof isw_before_ajax && isw_before_ajax(), t.event.trigger("isw_before_ajax", [e]), jQuery.get(e, function (e) {
                    var s = t(e), p = s.find(a.wrapper_products);
                    if (c = s.filter("title").text(), p.length > 0) {
                        n = "new-item" + l++;
                        var f = s.find(d);
                        if (i) {
                            t(d).find(a.selector_prev).replaceWith(f.find(a.selector_prev));
                            var u = t('<div class="ajax-load-item less-' + n + '"></div>');
                            r.prepend(u.append(p.html())), !0 === o && t(".rating-com-view").starRating({
                                totalStars: 5,
                                emptyColor: "#fff",
                                strokeColor: "#FFB300",
                                hoverColor: "#FFB300",
                                activeColor: "#FFB300",
                                ratedColor: "#FFB300",
                                strokeWidth: 70,
                                starSize: 12,
                                useGradient: !1,
                                readOnly: !0
                            }), u.find(".ajax-animate-card").each(function (e) {
                                TweenLite.to(t(this), 1, {
                                    delay: .05 * e,
                                    y: 0,
                                    z: .01,
                                    opacity: 1,
                                    ease: Power4.easeInOut
                                })
                            })
                        } else {
                            t(d).find(a.selector_next).replaceWith(f.find(a.selector_next));
                            var _ = t('<div class="ajax-load-item more-' + n + '"></div>');
                            r.append(_.append(p.html())), !0 === o && t(".rating-com-view").starRating({
                                totalStars: 5,
                                emptyColor: "#fff",
                                strokeColor: "#FFB300",
                                hoverColor: "#FFB300",
                                activeColor: "#FFB300",
                                ratedColor: "#FFB300",
                                strokeWidth: 70,
                                starSize: 12,
                                useGradient: !1,
                                readOnly: !0
                            }), _.find(".ajax-animate-card").each(function (e) {
                                TweenLite.to(t(this), 1, {
                                    delay: .05 * e,
                                    y: 0,
                                    z: .01,
                                    opacity: 1,
                                    ease: Power4.easeInOut
                                })
                            })
                        }
                    }
                }).done(function () {
                    if(!!$("#ajax-load-post").data("no-url")) {
                        var o = {
                            scrollTop: t(window).scrollTop() + parseInt(a.start_loading_x_from_end),
                            title: c,
                            url: e
                        };
                        s && (false, t.event.trigger("infiniteScrollPageChanged", [o])), i ? (_ = !1, v.addPreviousPage(o)) : (u = !1, v.addNextPage(o)), t("#isw-load-more-button").removeClass("pulser-animate"), t("#isw-load-more-button-prev").removeClass("pulser-animate"), void 0 === t("#ajax-post-pagination .next").attr("href") && t("#article-load-more").hide(), void 0 === t("#ajax-post-pagination .prev").attr("href") && t("#article-load-less").slideUp(), "function" == typeof isw_ajax_done && isw_ajax_done(), t.event.trigger("isw_ajax_done", [n])
                    }else{
                        var o = {scrollTop: t(window).scrollTop() + parseInt(a.start_loading_x_from_end), title: c, url: e};
                        s && (History.replaceState(o, c, e), t.event.trigger("infiniteScrollPageChanged", [o])), i ? (_ = !1, v.addPreviousPage(o)) : (u = !1, v.addNextPage(o)), t("#isw-load-more-button").removeClass("pulser-animate"), t("#isw-load-more-button-prev").removeClass("pulser-animate"), void 0 === t("#ajax-post-pagination .next").attr("href") && t("#article-load-more").hide(), void 0 === t("#ajax-post-pagination .prev").attr("href") && t("#article-load-less").slideUp(), "function" == typeof isw_ajax_done && isw_ajax_done(), t.event.trigger("isw_ajax_done", [n])
                    }
                }).fail(function () {
                    "function" == typeof isw_ajax_fail && isw_ajax_fail(), t.event.trigger("isw_ajax_fail")
                }).always(function () {
                    "function" == typeof isw_after_ajax && isw_after_ajax(), t.event.trigger("isw_after_ajax")
                }))
            }, isScrolledToBottom: function (e) {
                return t(e).length > 0 && t(window).scrollTop() >= t(e).offset().top + t(e).outerHeight() - window.innerHeight - parseInt(a.start_loading_x_from_end)
            }, isScrolledToTop: function (e) {
                return t(e).length > 0 && t(window).scrollTop() < t(e).offset().top
            }
        };
        History.Adapter.bind(window, "statechange", function () {
            History.getState()
        });
        var v = g;
        return g.element = this, g.init()
    }
}(jQuery), jQuery(function () {
    $("#ajax-load-post").length && jQuery(window).pantrif_infinite_scroll()
});

//Load more
!function (e) {
    e.fn.pantrif_infinite_scroll_add = function (t) {
        var a = e.extend({
                ajax_method: "method_load_more_button",
                selector_next: ".next",
                selector_prev: ".prev",
                enable_history: "on",
                start_loading_x_from_end: "0",
                wrapper_pagination: "#ajax-post-pagination-add",
                wrapper_products: "#ajax-load-post-add"
            }, t), o = e(a.wrapper_products), i = o.height(), n = "", r = 0, d = 0, l = a.wrapper_pagination, s = [],
            p = e("title").text(), c = window.location.href, f = !1, u = !1, _ = o.offset().top, w = _ + o.height(),
            h = _ - 100, g = {
                init: function () {
                    void 0 !== e("#ajax-post-pagination-add .next").attr("href") && e("#article-load-more-add").show(), void 0 !== e("#ajax-post-pagination-add .prev").attr("href") && e("#article-load-less-add").show();
                    var t = {scrollTop: o.offset().top, title: p, url: c};
                    s.push([d++, t]), v.updatePage(), e("body").on("click", "#isw-load-more-button-add", function () {
                        e(this).addClass("pulser-animate"), setTimeout(function () {
                            v.products_loop()
                        }, 1400)
                    }), e("body").on("click", "#isw-load-more-button-prev-add", function () {
                        e(this).addClass("pulser-animate"), setTimeout(function () {
                            v.products_loop("", !0)
                        }, 1400)
                    }), e(v.element).scroll(function (e) {
                        o.length > 0 && (v.isScrolledToBottom(a.wrapper_products) && !f && (f = !0), v.isScrolledToTop(a.wrapper_products) && !u && (u = !0))
                    })
                }, updatePage: function () {
                    e(v.element).scroll(function (t) {
                        var a = e(window).scrollTop(), o = v.closest(a, s);
                        h < a && w > a && History.replaceState({}, o.title, o.url)
                    })
                }, closest: function (e, t) {
                    for (var a = t[0][1].scrollTop, o = t[0][1], i = Math.abs(e - a), n = 0; n < t.length; n++) {
                        var r = Math.abs(e - t[n][1].scrollTop);
                        r < i && (i = r, a = t[n][1].scrollTop, o = t[n][1])
                    }
                    return o
                }, isScrolledIntoPage: function (t) {
                    var a = e(window).scrollTop(), o = a + e(window).height(), i = e(t).offset().top;
                    return i + e(t).height() <= o && i >= a
                }, addPreviousPage: function (e) {
                    s.unshift([0, e]), d++;
                    for (var t = 1, a = s.length; t < a; t++) s[t][0] = s[t][0] + 1, s[t][1].scrollTop = s[t][1].scrollTop + i
                }, addNextPage: function (e) {
                    s.push([d++, e])
                }, products_loop: function (t, i, d) {
                    if (void 0 === i && (i = !1), void 0 === d && (d = !0), void 0 === t || "" === t) t = i ? e("#ajax-post-pagination-add .prev").attr("href") : e("#ajax-post-pagination-add .next").attr("href");
                    i ? u = !0 : f = !0, void 0 !== t && ("function" == typeof isw_before_ajax && isw_before_ajax(), e.event.trigger("isw_before_ajax", [t]), jQuery.get(t, function (t) {
                        var d = e(t), s = d.find(a.wrapper_products);
                        if (p = d.filter("title").text(), s.length > 0) {
                            n = "new-item" + r++;
                            var c = d.find(l);
                            if (i) {
                                e(l).find(a.selector_prev).replaceWith(c.find(a.selector_prev));
                                var f = e('<div class="ajax-load-item less-' + n + '"></div>');
                                o.prepend(f.append(s.html())), f.find(".ajax-animate-card").each(function (t) {
                                    TweenLite.to(e(this), 1, {
                                        delay: .05 * t,
                                        y: 0,
                                        z: .01,
                                        opacity: 1,
                                        ease: Power4.easeInOut
                                    })
                                })
                            } else {
                                e(l).find(a.selector_next).replaceWith(c.find(a.selector_next));
                                var u = e('<div class="ajax-load-item more-' + n + '"></div>');
                                o.append(u.append(s.html())), u.find(".ajax-animate-card").each(function (t) {
                                    TweenLite.to(e(this), 1, {
                                        delay: .05 * t,
                                        y: 0,
                                        z: .01,
                                        opacity: 1,
                                        ease: Power4.easeInOut
                                    })
                                })
                            }
                        }
                    }).done(function () {
                        var o = {scrollTop: e(window).scrollTop() + parseInt(a.start_loading_x_from_end), title: p, url: t};
                        d && (History.replaceState(o, p, t), e.event.trigger("infiniteScrollPageChanged", [o])), i ? (u = !1, v.addPreviousPage(o)) : (f = !1, v.addNextPage(o)), e("#isw-load-more-button-add").removeClass("pulser-animate"), e("#isw-load-more-button-prev-add").removeClass("pulser-animate"), void 0 === e("#ajax-post-pagination-add .next").attr("href") && e("#article-load-more-add").hide(), void 0 === e("#ajax-post-pagination-add .prev").attr("href") && e("#article-load-less-add").slideUp(), "function" == typeof isw_ajax_done && isw_ajax_done(), e.event.trigger("isw_ajax_done", [n])
                    }).fail(function () {
                        "function" == typeof isw_ajax_fail && isw_ajax_fail(), e.event.trigger("isw_ajax_fail")
                    }).always(function () {
                        "function" == typeof isw_after_ajax && isw_after_ajax(), e.event.trigger("isw_after_ajax")
                    }))
                }, isScrolledToBottom: function (t) {
                    return e(t).length > 0 && e(window).scrollTop() >= e(t).offset().top + e(t).outerHeight() - window.innerHeight - parseInt(a.start_loading_x_from_end)
                }, isScrolledToTop: function (t) {
                    return e(t).length > 0 && e(window).scrollTop() < e(t).offset().top
                }
            };
        History.Adapter.bind(window, "statechange", function () {
            History.getState()
        });
        var v = g;
        return g.element = this, g.init()
    }
}(jQuery), jQuery(function () {
    $("#ajax-load-post-add").length && jQuery(window).pantrif_infinite_scroll_add()
});

//JQuery Rating Star
!function (t, e, s, i) {
    "use strict";
    var a = "starRating", r = function () {
    }, n = {
        totalStars: 5,
        useFullStars: !1,
        starShape: "straight",
        emptyColor: "lightgray",
        hoverColor: "orange",
        activeColor: "gold",
        ratedColor: "crimson",
        useGradient: !0,
        readOnly: !1,
        disableAfterRate: !0,
        baseUrl: !1,
        starGradient: {start: "#FEF7CD", end: "#FF9511"},
        strokeWidth: 4,
        strokeColor: "black",
        initialRating: 0,
        starSize: 40,
        callback: r,
        onHover: r,
        onLeave: r
    }, o = function (e, s) {
        var i, r;
        this.element = e, this.$el = t(e), this.settings = t.extend({}, n, s), i = this.$el.data("rating") || this.settings.initialRating, r = ((this.settings.forceRoundUp ? Math.ceil : Math.round)(2 * i) / 2).toFixed(1), this._state = {rating: r}, this._uid = Math.floor(999 * Math.random()), s.starGradient || this.settings.useGradient || (this.settings.starGradient.start = this.settings.starGradient.end = this.settings.activeColor), this._defaults = n, this._name = a, this.init()
    }, h = {
        init: function () {
            this.renderMarkup(), this.addListeners(), this.initRating()
        }, addListeners: function () {
            this.settings.readOnly || (this.$stars.on("mouseover", this.hoverRating.bind(this)), this.$stars.on("mouseout", this.restoreState.bind(this)), this.$stars.on("click", this.handleRating.bind(this)))
        }, hoverRating: function (t) {
            var e = this.getIndex(t);
            this.paintStars(e, "hovered"), this.settings.onHover(e + 1, this._state.rating, this.$el)
        }, handleRating: function (t) {
            var e = this.getIndex(t) + 1;
            this.applyRating(e, this.$el), this.executeCallback(e, this.$el), this.settings.disableAfterRate && this.$stars.off()
        }, applyRating: function (t) {
            var e = t - 1;
            this.paintStars(e, "rated"), this._state.rating = e + 1, this._state.rated = !0
        }, restoreState: function (t) {
            var e = this.getIndex(t), s = this._state.rating || -1, i = this._state.rated ? "rated" : "active";
            this.paintStars(s - 1, i), this.settings.onLeave(e + 1, this._state.rating, this.$el)
        }, getIndex: function (e) {
            var s = t(e.currentTarget), i = s.width(), a = t(e.target).attr("data-side");
            a = a || this.getOffsetByPixel(e, s, i), a = this.settings.useFullStars ? "right" : a;
            var r = s.index() - ("left" === a ? .5 : 0);
            return r = r < .5 && e.offsetX < i / 4 ? -1 : r
        }, getOffsetByPixel: function (t, e, s) {
            return t.pageX - e.offset().left <= s / 2 && !this.settings.useFullStars ? "left" : "right"
        }, initRating: function () {
            this.paintStars(this._state.rating - 1, "active")
        }, paintStars: function (e, s) {
            var i, a, r, n;
            t.each(this.$stars, function (o, h) {
                i = t(h).find('[data-side="left"]'), a = t(h).find('[data-side="right"]'), r = n = o <= e ? s : "empty", r = o - e == .5 ? s : r, i.attr("class", "svg-" + r + "-" + this._uid), a.attr("class", "svg-" + n + "-" + this._uid)
            }.bind(this))
        }, renderMarkup: function () {
            for (var t = this.settings, e = t.baseUrl ? location.href.split("#")[0] : "", s = '<div class="jq-star" style="width:' + t.starSize + "px;  height:" + t.starSize + 'px;"><svg preserveAspectRatio="xMinYMin meet" version="1.0" class="jq-star-svg" shape-rendering="geometricPrecision" xmlns="http://www.w3.org/2000/svg" ' + this.getSvgDimensions(t.starShape) + " stroke-width:" + t.strokeWidth + 'px;" xml:space="preserve"><style type="text/css">.svg-empty-' + this._uid + "{fill:url(" + e + "#" + this._uid + "_SVGID_1_);}.svg-hovered-" + this._uid + "{fill:url(" + e + "#" + this._uid + "_SVGID_2_);}.svg-active-" + this._uid + "{fill:url(" + e + "#" + this._uid + "_SVGID_3_);}.svg-rated-" + this._uid + "{fill:" + t.ratedColor + ";}</style>" + this.getLinearGradient(this._uid + "_SVGID_1_", t.emptyColor, t.emptyColor, t.starShape) + this.getLinearGradient(this._uid + "_SVGID_2_", t.hoverColor, t.hoverColor, t.starShape) + this.getLinearGradient(this._uid + "_SVGID_3_", t.starGradient.start, t.starGradient.end, t.starShape) + this.getVectorPath(this._uid, {
                starShape: t.starShape,
                strokeWidth: t.strokeWidth,
                strokeColor: t.strokeColor
            }) + "</svg></div>", i = "", a = 0; a < t.totalStars; a++) i += s;
            this.$el.append(i), this.$stars = this.$el.find(".jq-star")
        }, getVectorPath: function (t, e) {
            return "rounded" === e.starShape ? this.getRoundedVectorPath(t, e) : this.getSpikeVectorPath(t, e)
        }, getSpikeVectorPath: function (t, e) {
            return '<polygon data-side="center" class="svg-empty-' + t + '" points="281.1,129.8 364,55.7 255.5,46.8 214,-59 172.5,46.8 64,55.4 146.8,129.7 121.1,241 212.9,181.1 213.9,181 306.5,241 " style="fill: transparent; stroke: ' + e.strokeColor + ';" /><polygon data-side="left" class="svg-empty-' + t + '" points="281.1,129.8 364,55.7 255.5,46.8 214,-59 172.5,46.8 64,55.4 146.8,129.7 121.1,241 213.9,181.1 213.9,181 306.5,241 " style="stroke-opacity: 0;" /><polygon data-side="right" class="svg-empty-' + t + '" points="364,55.7 255.5,46.8 214,-59 213.9,181 306.5,241 281.1,129.8 " style="stroke-opacity: 0;" />'
        }, getRoundedVectorPath: function (t, e) {
            var s = "M520.9,336.5c-3.8-11.8-14.2-20.5-26.5-22.2l-140.9-20.5l-63-127.7 c-5.5-11.2-16.8-18.2-29.3-18.2c-12.5,0-23.8,7-29.3,18.2l-63,127.7L28,314.2C15.7,316,5.4,324.7,1.6,336.5S1,361.3,9.9,370 l102,99.4l-24,140.3c-2.1,12.3,2.9,24.6,13,32c5.7,4.2,12.4,6.2,19.2,6.2c5.2,0,10.5-1.2,15.2-3.8l126-66.3l126,66.2 c4.8,2.6,10,3.8,15.2,3.8c6.8,0,13.5-2.1,19.2-6.2c10.1-7.3,15.1-19.7,13-32l-24-140.3l102-99.4 C521.6,361.3,524.8,348.3,520.9,336.5z";
            return '<path data-side="center" class="svg-empty-' + t + '" d="' + s + '" style="stroke: ' + e.strokeColor + '; fill: transparent; " /><path data-side="right" class="svg-empty-' + t + '" d="' + s + '" style="stroke-opacity: 0;" /><path data-side="left" class="svg-empty-' + t + '" d="M121,648c-7.3,0-14.1-2.2-19.8-6.4c-10.4-7.6-15.6-20.3-13.4-33l24-139.9l-101.6-99 c-9.1-8.9-12.4-22.4-8.6-34.5c3.9-12.1,14.6-21.1,27.2-23l140.4-20.4L232,164.6c5.7-11.6,17.3-18.8,30.2-16.8c0.6,0,1,0.4,1,1 v430.1c0,0.4-0.2,0.7-0.5,0.9l-126,66.3C132,646.6,126.6,648,121,648z" style="stroke: ' + e.strokeColor + '; stroke-opacity: 0;" />'
        }, getSvgDimensions: function (t) {
            return "rounded" === t ? 'width="550px" height="500.2px" viewBox="0 146.8 550 500.2" style="enable-background:new 0 0 550 500.2;' : 'x="0px" y="0px" width="305px" height="305px" viewBox="60 -62 309 309" style="enable-background:new 64 -59 305 305;'
        }, getLinearGradient: function (t, e, s, i) {
            return '<linearGradient id="' + t + '" gradientUnits="userSpaceOnUse" x1="0" y1="-50" x2="0" y2="' + ("rounded" === i ? 500 : 250) + '"><stop  offset="0" style="stop-color:' + e + '"/><stop  offset="1" style="stop-color:' + s + '"/> </linearGradient>'
        }, executeCallback: function (t, e) {
            (0, this.settings.callback)(t, e)
        }
    }, l = {
        unload: function () {
            var e = "plugin_" + a, s = t(this);
            s.data(e).$stars.off(), s.removeData(e).remove()
        }, setRating: function (e, s) {
            var i = t(this).data("plugin_starRating");
            e > i.settings.totalStars || e < 0 || (s && (e = Math.round(e)), i.applyRating(e))
        }, getRating: function () {
            return t(this).data("plugin_starRating")._state.rating
        }, resize: function (e) {
            var s = t(this).data("plugin_starRating").$stars;
            e <= 1 || e > 200 ? console.log("star size out of bounds") : (s = Array.prototype.slice.call(s)).forEach(function (s) {
                t(s).css({width: e + "px", height: e + "px"})
            })
        }, setReadOnly: function (e) {
            var s = t(this).data("plugin_starRating");
            !0 === e ? s.$stars.off("mouseover mouseout click") : (s.settings.readOnly = !1, s.addListeners())
        }
    };
    t.extend(o.prototype, h), t.fn[a] = function (e) {
        if (!t.isPlainObject(e)) {
            if (l.hasOwnProperty(e)) return l[e].apply(this, Array.prototype.slice.call(arguments, 1));
            t.error("Method " + e + " does not exist on " + a + ".js")
        }
        return this.each(function () {
            t.data(this, "plugin_" + a) || t.data(this, "plugin_" + a, new o(this, e))
        })
    }
}(jQuery, window, document);

//Google place
!function () {
    "use strict";
    $.ajax({
        url: "https://maps.googleapis.com/maps/api/js?key=AIzaSyCeh0JpZ7LwDSJKurpONkUWp-kRac_B8zo&libraries=places",
        dataType: "script",
        cache: !0,
        success: function () {
            !function () {
                var e = document.getElementById("route-field");
                if (!e) return;
                var t = new google.maps.places.Autocomplete(e, {
                    types: ["address"],
                    componentRestrictions: {country: "UA"}
                });
                t.addListener("place_changed", function (o) {
                    var n = t.getPlace();
                    e.value = n.name
                }), google.maps.event.addDomListener(e, "keydown", function (e) {
                    13 !== e.keyCode || e.triggered || (event.preventDefault(), event.stopPropagation(), 0 === $(".pac-item-selected").length ? (google.maps.event.trigger(this, "keydown", {keyCode: 40}), google.maps.event.trigger(this, "keydown", {
                        keyCode: 13,
                        triggered: !0
                    })) : google.maps.event.trigger(this, "keydown", {keyCode: 13, triggered: !0}))
                })
            }()
        }
    })
}();

