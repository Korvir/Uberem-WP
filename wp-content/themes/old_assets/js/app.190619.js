//Main
$(window).bind("pageshow", function(event) {
    if (event.originalEvent.persisted) {
        window.location.reload()
    }
});
$(document).ready(function () {



//GLOBAL VARIABLE
    var WindowH = $(window).height(),
        WindowW = $(window).width(),
        Body = $('body'),
        Html = $('html'),
        outWidth = $(window).outerWidth(),
        language = document.getElementsByTagName('html')[0].getAttribute('lang');

    var body = document.getElementsByTagName("body")[0];



//SMOOTH SCROLL
    SmoothScroll({
        stepSize: 75,
    });


// remove the empty element
    $('.single-article img').unwrap('p');


//DETECT MOBILE SAFARI FOR MENU
    var iOSSafari = /iP(ad|od|hone)/i.test(window.navigator.userAgent) && /WebKit/i.test(window.navigator.userAgent) && !(/(CriOS|FxiOS|OPiOS|mercury)/i.test(window.navigator.userAgent));
    if (iOSSafari === true) {
        Body.addClass('mobile-safari');
    }


//FULL SCREEN HEIGHT FOR ATICLE IMAGE
//     $('.full-height').height(WindowH);


//TITLE ANIMATION WRAPPING
    $(document).ready(function () {
        //page nashi-uslugi
        $('#load-more-service').on("click",function () {
           var cards =  $("#ajax-load-post").find(".hidden-card-service-js");
           if(cards.length){
               if(cards.length < 6){
                   $(this).parent("div").remove();
               }
               cards.each(function( index ) {
                   if(index < 6 || $( this ).hasClass('hidden-card-service-js_need-remove')){
                       $( this ).removeClass("hidden-card-service-js hidden-card-service").addClass("showed-card-service");
                   }else {
                       return false;
                   }
               });

           }else {
               $(this).parent("div").remove();
           }
        });

        if($('#reviews-more').length) {
            $('#load-more-service').trigger("click");
        }

        $(".reveal-title, .slide-content-title h2").each(function () {

            var title = $(this),
                width = title.width();

            title.html(function (i, html) {
                return html.replace(/\s+/g, '*');
            });
            title.find('big').html(function (i, html) {
                return html.replace(/\*/g, ' ');
            });
            var texts = title.html().split("*");
            title.html('<span>' + texts.join('</span> <span>') + '</span>');

            title.find("span").each(function () {
                var span = $(this);
                if ((span.position().left + span.width()) > width) {
                    span.before('<br>');
                }
            });

            title.find("span").contents().unwrap();
            var lines = title.html().split("<br>");
            title.html('<span class="reveal-wrap"><span class="reveal">' + lines.join('</span></span><span class="reveal-wrap"><span class="reveal">') + '</span></span>');

        });
    });


//ON ORIENTATION CHANGE
    var OrienWidth,
        OrienHeight,
        Orientation,
        DefaultPort = (WindowW > WindowH) ? 90 : 0;
    if (DefaultPort === 90) {
        Body.addClass('portret');
    }

    $(window).bind("resize", function () {
        OrienWidth = $(window).width(), OrienHeight = $(window).height();
        Orientation = (OrienWidth > OrienHeight) ? 90 : 0;

        if (DefaultPort != Orientation) {

            // $('.full-height').css('height', OrienHeight);
            if (Orientation === 90)
                Body.addClass('portret');
            else
                Body.removeClass('portret');

            DefaultPort = Orientation;

        }
    });


//PRICING TABS ON MOBILE DEVICES
    if (992 > WindowW) {
        mobileTabs();
    }

    function mobileTabs() {
        $('#pricing-info .row').addClass('tabs').prepend('<ul class="tabs-caption"><li class="trans-сlr trans-bg active"></li><li class="trans-сlr trans-bg"></li></ul>');

        $('#pricing-info .col-lg-6').each(function (i) {
            if (0 === i) {
                var title = $(this).wrap("<div class='tabs-content active'></div>").find('h3');
                $('#pricing-info .tabs-caption li:first').text(title.text().replace(/([.:!?])+/g, ''));
                title.remove();
            } else {
                var title = $(this).wrap("<div class='tabs-content'></div>").find('h3');
                $('#pricing-info .tabs-caption li:last').text(title.text().replace(/([.:!?])+/g, ''));
                title.remove();
            }
        });
    }


//TABS
    $('ul.tabs-caption').on('click', 'li:not(.active)', function () {
        $(this)
            .addClass('active').siblings().removeClass('active')
            .closest('div.tabs').find('div.tabs-content').removeClass('active').eq($(this).index()).addClass('active printed');
    });


//IMAGE MARKER
    if ($('#works-section').length) {
        $('#works-section .marker-img-wrap').scalize();
    }


//INSERT REVIEW IMAGE
    $('.review-slider .review-slide').each(function (i) {
        $(".review-img-container").append('<div data-index="' + i + '" class="review-img" style="background-image: url(' + $(this).data('review-img') + ')"></div>');
        $(this).find('.review-slide-autor').prepend('<img class="aut-img" src="' + $(this).data('review-img-mobile')+'">');
    });


    $('.review-img-container .review-img:first').css({
        "z-index": "1",
        "opacity": "1"
    });


    var tlReview = new TimelineLite();

    $('.review-slider').on("beforeChange", function (event, slick, currentSlide, nextSlide) {
        $('.review-img-wrap').addClass('animate-end');

        var oldSlider = $('.review-img[data-index="' + $(slick.$slides.get(currentSlide)).attr('data-slick-index') + '"]'),
            newSlider = $('.review-img[data-index="' + $(slick.$slides.get(nextSlide)).attr('data-slick-index') + '"]');

        tlReview.clear();
        tlReview
            .fromTo(oldSlider, 1.5, {opacity: 1}, {opacity: 0})
            .set(oldSlider, {"z-index": 2}, 0)
            .fromTo(newSlider, 5, {scale: 1}, {scale: 1.1}, 0)
            .set(newSlider, {opacity: 1, "z-index": 1, visibility: "visible"}, 0);
    });


//REVIEW SLIDER
    $('.review-slider').slick({
        infinite: true,
        arrows: false,
        dots: true,
        autoplay: false,
        speed: 1520,
        slidesToShow: 1,
        slidesToScroll: 1,
        appendDots: $('.review-dots'),
        fade: true
    });


//WORKERS SLIDER
    $('.workers-slider').slick({
        infinite: true,
        arrows: false,
        dots: true,
        autoplay: false,
        speed: 800,
        slidesToShow: 4,
        slidesToScroll: 1,
        responsive: [
            {
                breakpoint: 1025,
                settings: {
                    slidesToShow: 3,
                }
            },
            {
                breakpoint: 769,
                settings: {
                    slidesToShow: 2,
                }
            },
            {
                breakpoint: 668,
                settings: {
                    slidesToShow: 1,
                    centerMode: true,
                    centerPadding: '44px',
                }
            },
        ]
    });


//PRICING MORE SERVICES SLIDER ON MOBILE
    if (667 > outWidth) {
        $('.more-services-row').slick({
            mobileFirst: true,
            slidesToShow: 1,
            dots: true,
            arrows: false,
            centerMode: true,
            centerPadding: '50px',
            responsive: [
                {
                    breakpoint: 667,
                    settings: "unslick"
                }
            ]
        });
    }

    if (1230 > outWidth) {

        $('.more-article-slider').slick({
            mobileFirst: true,
            slidesToShow: 1,
            dots: true,
            arrows: false,
            slidesToScroll: 1,
            centerMode: true,
            centerPadding: '25px',
            responsive: [
                {
                    breakpoint: 667,
                    settings: {
                        slidesToShow: 2,
                        centerMode: false,
                        centerPadding: '0px',
                    }
                },
                {
                    breakpoint: 1024,
                    settings: {
                        slidesToShow: 2,
                        centerMode: false,
                        centerPadding: '0px',
                    }
                },
                {
                    breakpoint: 1230,
                    settings: {
                        slidesToShow: 3,
                        centerMode: false,
                        centerPadding: '0px',
                    }
                },
            ]

        });

    }


//MENU POP-UP BUTTON
    $(".menu-modal-btn a").click(function (event) {
        event.preventDefault();

        WindowH < $("#modal-menu .modal").height() + 100 && Html.addClass("full-height-modal");

        $('#modal-menu').addClass('modal-show');

    });


//DISCOUNT MULTIPLY POP-UP
    $(".modal-discount").click(function (event) {
        event.preventDefault();

        var ruleData = $(this).data('rule');
        //$('.discount-rule').html( ruleData ),

        $('#discount-rule .wpcf7-list-item-label').text(ruleData);
        $('#discount-rule input').val(ruleData);
        //console.log( $('#discount-rule input') );

        WindowH < $("#modal-discount .modal").height() + 100 && Html.addClass("full-height-modal"),

            $('#modal-discount').addClass('modal-show');
        $('.discounts-rule-title').val(ruleData);
    });


//OPEN POP-UP
    $(".modal-trigger").click(function (event) {
        event.preventDefault();

        var modalOverlay = $('#' + $(this).data('modal'));

        if (WindowH < modalOverlay.find('.modal').height() + 100) {
            Html.addClass('full-height-modal');
        }

        modalOverlay.addClass('modal-show');
    });

//CLOSE POP-UP ON CLOSE BTN CLICK
    $(".modal-close").click(function () {
        $(this).parents('.modal-overlay').removeClass('modal-show');

        setTimeout(function () {
            Html.removeClass('full-height-modal');
        }, 300);

    });

//CLOSE POP-UP ON OVERLAY CLICK
    $(".modal-overlay").click(function (e) {
        if (e.target !== this)
            return;

        $(this).removeClass('modal-show');

        setTimeout(function () {
            Html.removeClass('full-height-modal');
        }, 300);

    });

//SHOW POP-UP ONLY ONE IN 24 HOURS
    if (!Cookies.get('isPopupShow')) {

        var autoModal = $('#modal-auto');

        var interval = setInterval(function () {
            if (!$('.modal-show').length) {
                if (WindowH < autoModal.children().height() + 100)
                    Html.addClass('full-height-modal');

                autoModal.addClass('modal-show');
                clearInterval(interval);
                Cookies.set('isPopupShow', true, {expires: 1, path: '/'});
            }
        }, 59000);

    }


//OPEN-CLOSE MENU
    function toggleClassMenu() {
        var layout = document.querySelector("body");

        if (!layout.classList.contains("menu-open")) {
            layout.classList.add("menu-open");
        } else {
            layout.classList.remove("menu-open");
        }
    }

    var oppMenu = document.querySelector(".menu-button");
    oppMenu.addEventListener("click", toggleClassMenu, false);


//ACCORDION FAQ PAGE
    $(".faq-item").on("click", ".faq-title", function () {
        $(this).parent(".faq-item").toggleClass("faq-active").find(".faq-content-wrap").slideToggle();
    });


//UNWRAP CF7 "wpcf7-form-control-wrap"
    $(".form-element .wpcf7-form-control-wrap input:not([type='checkbox']), .form-element .wpcf7-form-control-wrap select").unwrap();


//FORM FILDS IF HAS VALUE VALIDATION
    $(".form-element-field").blur(function () {
        var inputValue = $(this).val();
        if (inputValue && inputValue.indexOf('-__') <= 0) {
            $(this).addClass("has-value");
        } else {
            $(this).removeClass("has-value");
        }
    });

    $(".form-element-select").blur(function () {
        var inputValue = $(this).val();
        if (inputValue) {
            $(this).addClass("has-value");
        } else {
            $(this).removeClass("has-value");
        }
    });

//FORM PHONE MASK
    if ($(".phone-mask").length > 0) {
        $(".phone-mask").mask("+38 (999) 999-99-99");
    }


//SMOOTH SCROLL TO ANCHOR
    $('a[href*="#"]').not('[href="#"]').not('[href="#0"]')
        .click(function (event) {
            if (location.pathname.replace(/^\//, '') == this.pathname.replace(/^\//, '') && location.hostname == this.hostname) {
                var target = $(this.hash);
                target = target.length ? target : $('[name=' + this.hash.slice(1) + ']');
                if (target.length) {
                    event.preventDefault();
                    $('html, body').animate({
                        scrollTop: target.offset().top
                    }, 900);
                }
            }
        });



//ANIMATE PRICE COUNT FROM TO
    function priceAnimate(element, end) {
        $({countNum: element.text()}).animate({countNum: end}, {
            duration: 600,
            easing: 'swing',
            step: function () {
                element.text(Math.floor(this.countNum));
            },
            complete: function () {
                element.text(this.countNum);
            }
        });
    }
    if(!window.priceAnimate){
        window.priceAnimate = priceAnimate;
    }






//DATE PICKER SETTING
    if ($('.datepicker-wrap').length) {
        $('.datepicker-wrap').datepicker({
            readonly: false,
            lang: language
        });
    }

//SOCIAL SHARE BUTTON
    $(".share-btn").on("click", function () {
        var link = this.href,
            top = (screen.availHeight - 500) / 2,
            left = (screen.availWidth - 500) / 2;
        window.open(link, "social sharing", "width=550,height=420,left=" + left + ",top=" + top + ",location=0,menubar=0,toolbar=0,status=0,scrollbars=1,resizable=1");
        return !1
    });


    var firsView = true;
    var outW = $(window).outerWidth();

    function view_on_init() {
        $('.reveal-title:in-viewport').addClass('printed');
        $('.section-sub-title:in-viewport').addClass('printed');
        $('.header-wrap:in-viewport').addClass('printed');
        $('.main-content:in-viewport').run(function () {
            $('.main-left-column').addClass('printed');
            this.siblings('.main-phone').addClass('printed');
        });
        $('.animate-block:in-viewport').addClass('printed');

        if (firsView === true) {
            $('#slide-1:in-viewport').addClass('slide-point').run(function () {
                firsView = false;
            });
        }
    }

    function view_on_scroll() {
        $(window).scroll(function () {
            $('.reveal-title:in-viewport').addClass('printed');
            $('.section-sub-title:in-viewport').addClass('printed');
            $('.header-wrap:in-viewport').addClass('printed');
            $('.main-content:in-viewport').run(function () {
                $('.main-left-column').addClass('printed');
                this.siblings('.main-phone').addClass('printed');
            });
            $('.animate-block:in-viewport').addClass('printed');

            if (firsView === true) {
                if (outW > 667) {
                    $('#slide-1:in-viewport').addClass('slide-point').run(function () {
                        firsView = false;
                    });
                } else {
                    $('#slider-wrap .slick-current:in-viewport').addClass('slick-active').run(function () {
                        firsView = false;
                    });
                }
            }
        });
    }

    function article_on_init() {
        $('.reveal-title:in-viewport').addClass('printed');
        $('.animate-block:in-viewport').addClass('printed');
    }

    function article_on_scroll() {
        $(window).scroll(function () {
            $('.reveal-title:in-viewport').addClass('printed');
            $('.animate-block:in-viewport').addClass('printed');
        });
    }


//PAGE PRELOADER
    var loadedCount = 0,
        imagesToLoad = $("img:not(.aut-img)").length + $('.bg-images:not(.review-img, .main-wrap, .main-background)').length,
        loadingProgress = 0;

    $('img:not(.aut-img), .bg-images:not(.review-img, .main-wrap, .main-background)').imagesLoaded({background: true}).progress(function (instance, image) {
        loadProgress();
    });

    function loadProgress(imgLoad, image) {
        loadedCount++;
        loadingProgress = (loadedCount / imagesToLoad);
        TweenLite.to(progressTl, 0.7, {progress: loadingProgress, ease: Linear.easeNone});
    }

//TIMELINE PROGRESS
    var progressTl = new TimelineMax({
        paused: true,
        onUpdate: progressUpdate,
        onComplete: loadComplete
    });

    progressTl
        .insert(new TweenLite($('.preloader-bar'), 0.5, {width: "100%", ease: Linear.easeNone}), 0);

    function progressUpdate() {
        loadingProgress = Math.round(progressTl.progress() * 100);
        $(".percent-count").text(loadingProgress);
    }

    function loadComplete() {
        if ($('.homepage').length) {
            $(document).scrollTop(0);
            //$('.slide-content').removeClass('slide-point');
        }

        setTimeout(function () {
            //PAGE ANIMATION AFTER PRELOADER
            if ($('.homepage').length) {
                view_on_init();
                view_on_scroll();
            }

            if ($('.article-body').length) {
                article_on_init();
                article_on_scroll();
            }

        }, 250);

        $("#callnowbutton").addClass("loadComplete");
        //PRELOADER OUT
        var preloaderOutTl = new TimelineMax();

        if ($('.homepage').length) {
            preloaderOutTl
                .to($('.preloader-bar'), 0.3, {autoAlpha: 0, ease: Linear.easeIn})
                .to($('.preloader-content'), 0.3, {y: 100, autoAlpha: 0, ease: Back.easeIn}, 0.1)
                .to($('.page-preloader'), 0.7, {yPercent: -100, ease: Power4.easeInOut})
                .set($('.page-preloader'), {className: '+=preloader-hidden'})
                .set($('.slide-content'), {className: '-=slide-point'});
        } else {
            preloaderOutTl
                .to($('.preloader-bar'), 0.3, {autoAlpha: 0, ease: Linear.easeIn})
                .set($('.page-preloader'), {className: '+=preloader-hidden'})
                .to(["header", "footer", "main"], 0.8, {ease: Linear.easeIn, autoAlpha: 1,});
        }

        return preloaderOutTl;
    }


//PRELOADER SUB PAGE ANIMATION
    var outPreloader = new TimelineMax();
    $('a:not([target="_blank"]):not([href^="#"]):not([href^="tel:"]):not([href^="mailto:"]):not(.share-btn):not(#cancel-comment-reply-link):not(.content-loader)').click(function (event) {
        event.preventDefault();

        var url = $(this).attr('href');

        if (Body.hasClass('menu-open')) {
            $('.menu-wrap').hide();

            setTimeout(function () {

                outPreloader
                    .to(["header", "footer", "main", ".after-main"], 0.6, {ease: Linear.easeOut, autoAlpha: 0,});

                setTimeout(function () {
                    window.location.href = url;
                }, 600);

            }, 50);
        } else {
            outPreloader
                .to(["header", "footer", "main", ".after-main"], 0.6, {ease: Linear.easeOut, autoAlpha: 0,});

            setTimeout(function () {
                window.location.href = url;
            }, 600);
        }

    });


//VERTICAL SCROLL SECTION
    function sliderInit() {

//Define variable
        var controller = new ScrollMagic.Controller(),
            sliderCount = $('.slide-content').length + 1,
            progressWrap = $('.progress-slider-wrap'),
            sliderContainer = $('#slider-container'),
            sliderXOffset = 100 - (100 / sliderCount),
            wipeAnimation,
            pinPosition,
            scene,
            yOffset,
            html;

//Create Slide, Progress Pin and Nav dots
        html = '<ul class="slider-dots">';
        for (var i = 1; i <= sliderCount; i++) {
            sliderContainer.append('<div id="slide-nav-' + i + '" class="slide"></div>');
            progressWrap.append('<div class="progress-pin" data-dots="dots-nav-' + i + '" data-slide="slide-' + i + '">' + i + '</div>');

            //Add slide navigation dot
            if (i != sliderCount)
                html += '<li id="dots-nav-' + i + '" data-index="' + i + '">0' + i + '<svg viewBox="0 0 17 8"><use xlink:href="#slider-arrow"></use></li>';
        }
        html += '</ul>';

//Apend nav dots
        $('#slider-wrap .container').prepend(html);

//Progress Slider Wrap
        var slideWidth = $('.slide').width(),
            offsetLeft = slideWidth / 2,
            progressWrapWidth = (slideWidth * (sliderCount - 1)) / 5,
            TimeLineAnim = progressWrapWidth * 4;

//Define movement of panels
        wipeAnimation = new TimelineMax()
        //.to(sliderContainer, 1, {x: '-'+sliderXOffset+'%'}, 0) // 100% - 3 * Ширина одной секции (100%/количество секций)
            .to(sliderContainer, 1, {x: '-' + sliderXOffset + '%'}, 0)
            .to(".progress-line", 1, {width: progressWrapWidth + 'px'}, 0)
            .to(progressWrap, 1, {x: TimeLineAnim + 'px'}, 0)

//Create scene to pin and link animation
        scene = new ScrollMagic.Scene({
            triggerElement: "#slider-wrap",
            triggerHook: "onLeave",
            //duration: (sliderCount*100)*2.5+"%" //Количество секций * 100  ТУТ!!!!!!!!!!!!!
            duration: sliderCount * 100 + "%" //Количество секций * 100
        })
            .setPin("#slider-wrap")
            .setTween(wipeAnimation)
            .addTo(controller);

//CSS for timiline container
        sliderContainer.css("width", sliderCount * 100 + "%");

//$('.slide').css("width",100/sliderCount+"%");
        $('.slide').css("width", 100 / sliderCount + "%");

        progressWrap.css({
            "left": offsetLeft,
            "width": progressWrapWidth
        });

//Progress Pin position
        yOffset = parseFloat(Math.trunc(progressWrapWidth / (sliderCount - 1)));
        $('.progress-pin').each(function (index) {
            pinPosition = index * yOffset;
            $(this).css("left", pinPosition).attr("data-position", pinPosition);
        });

    }


    if ($('.slider-section').length > 0 && outW > 667) {

        sliderInit(); //Init Scroll Magic

        var lineWidth;
        var lastScrollTop = 0;
        var pointWidth = $('.progress-pin[data-slide="slide-2"]').data('position');

        $(window).scroll(function () {
            var st = $(this).scrollTop();

            if (st > lastScrollTop)
                $('.slider-dots li.dots-point').removeClass('dots-up').addClass('dots-down');
            else
                $('.slider-dots li.dots-point').removeClass('dots-down').addClass('dots-up');

            sliderDownAnim();

            lastScrollTop = st;
        });



    } else {  //Slider section for Mobile

        $('.slider-content-wrap .container').on('init', function (event, slick) {
            slick.$slides[0].classList.remove("slick-active");
        });

        $('.slider-content-wrap .container').slick({
            infinite: true,
            arrows: false,
            dots: true,
            autoplay: false,
            speed: 100,
            slidesToShow: 1,
            slidesToScroll: 1,
            fade: true,
            prevArrow: $('#prev-slides'),
            nextArrow: $('#next-slides'),
            arrows: true,
            customPaging: function (slider, i) {
                var thumb = $(slider.$slides[i]).data();
                return '<span>0' + (i + 1) + '</span>';
            },
        });

        $('.slider-content-slick-nav button').click(function () {
            mobileNavClick($(this));
        });

        function mobileNavClick(el) {
            el.addClass('nav-clicked');
            setTimeout(function () {
                el.removeClass('nav-clicked');
            }, 500);
        }

    }


//HOME PAGE ASYNC IMAGE SCROLL
    if ($(".homepage").length && outW >= 1200) {
        $("#main-section .main-background").paroller({
            factor: 0.12,
            factorSm: 0.1,
            factorXs: 0.1,
            type: 'background',
            direction: 'vertical'
        });
        $("#main-section .main-content-async").paroller({
            factor: 0.2,
            factorSm: 0.2,
            factorXs: 0.2,
            direction: 'vertical',
            type: 'foreground',
        });
    }

    if ($(".homepage").length && outW >= 1200 || $(".article-body").length && $("#review-image-wrap").length && outW >= 1200) {
        $(".review-img-column").paroller({
            factor: 0.05,
            factorSm: 0.05,
            factorXs: 0,
            direction: 'vertical',
            type: 'foreground',
        });
        $(".subscription-card").paroller({
            factor: 0.05,
            factorSm: 0.05,
            factorXs: 0,
            direction: 'vertical',
            type: 'foreground',
        });
    }


//COMMENTS RATING STAR
    $(".rating-form-input").starRating({
        totalStars: 5,
        emptyColor: '#fff',
        strokeColor: '#FFB300',
        hoverColor: '#FFB300',
        activeColor: '#FFB300',
        ratedColor: '#FFB300',
        initialRating: 0,
        strokeWidth: 34,
        starSize: 23,
        useGradient: false,
        disableAfterRate: false,
        callback: function (currentRating, $el) {
            $('.rating-field').val(currentRating);
        }
    });

    $(".rating-com-view").starRating({
        totalStars: 5,
        emptyColor: '#fff',
        strokeColor: '#FFB300',
        hoverColor: '#FFB300',
        activeColor: '#FFB300',
        ratedColor: '#FFB300',
        strokeWidth: 42,
        starSize: 12,
        useGradient: false,
        readOnly: true
    });

    $(".rating-all-view").starRating({
        totalStars: 5,
        emptyColor: '#fff',
        strokeColor: '#FFB300',
        hoverColor: '#FFB300',
        activeColor: '#FFB300',
        ratedColor: '#FFB300',
        strokeWidth: 30,
        starSize: 34,
        useGradient: false,
        readOnly: true
    });


//CONTACT FORM VALIDATION

    $(".wpcf7 form").submit(function () {
        $(this).closest('.modal').addClass('loading');
    });

    document.addEventListener('wpcf7submit', function (event) {
        $('#' + event.detail.id).closest('.modal').removeClass('loading');
    }, false);


    $(".wpcf7-form .wpcf7-form-control").focus(function () {
        $(this).parent().removeClass("field-invalid field-valid");
    });

    document.addEventListener('wpcf7invalid', function (event) {
        $('#' + event.detail.id).find('.wpcf7-form-control').each(function () {
            if ($(this).hasClass("wpcf7-not-valid")) {
                $(this).parent().addClass("field-invalid");
            } else {
                $(this).parent().addClass("field-valid");
            }
        });

    }, false);

    document.addEventListener('wpcf7mailsent', function (event) {
        var form = $('#' + event.detail.id);
        var message = form.find('.form-mail-send');

        message.fadeIn(500).addClass('form-mail-animate');

        form.find('input').removeClass('has-value');

        setTimeout(function () {
            form.parents('.modal-overlay').removeClass('modal-show');

            setTimeout(function () {
                Html.removeClass('full-height-modal');
                message.fadeOut().removeClass('form-mail-animate');
            }, 300);
        }, 3000);

    }, false);


//ASINC HOME MOVE
    if ($('.homepage').length > 0 && outW >= 1200) {

        var x,
            y,
            xmouse,
            ymouse,
            dx = void 0,
            dy = void 0,
            hImg = $('.main-section .col-lg-7'),
            hContent = $('.main-content'),
            hDecor = $('.main-decoration-wrap');

        $('.main-section, .header-sidebar').mousemove(function (event) {

            xmouse = event.clientX || event.pageX;
            ymouse = event.clientY || event.pageY;

            if (!x || !y) {
                x = ((WindowW / 2) - xmouse) * 0.1;
                y = ((WindowH / 2) - ymouse) * 0.1;
            } else {
                dx = (xmouse - x) * 0.125;
                dy = (ymouse - y) * 0.125;
                if (Math.abs(dx) + Math.abs(dy) < 0.1) {
                    x = xmouse;
                    y = ymouse;
                } else {
                    x += dx;
                    y += dy;
                }
            }

            hDecor.css({
                '-webit-transform': 'translate3d(-' + x / 100 + 'px,-' + y / 100 + 'px,0)',
                'transform': 'translate3d(-' + x / 100 + 'px,-' + y / 100 + 'px,0)'
            });

            hContent.css({
                '-webit-transform': 'translate3d(-' + x / 70 + 'px,-' + y / 70 + 'px,0) translate(0,-50%)',
                'transform': 'translate3d(-' + x / 70 + 'px,-' + y / 70 + 'px,0) translate(0,-50%)'
            });

            hImg.css({
                '-webit-transform': 'translate3d(-' + x / 70 + 'px,-' + y / 70 + 'px,0) translate(0,-50%)',
                'transform': 'translate3d(-' + x / 140 + 'px,-' + y / 140 + 'px,0)'
            });
        });

    }

    function sliderDownAnim() {
        var lineWidth = parseFloat(document.getElementById("progress-line").offsetWidth);

        $('.progress-pin').each(function () {

            var pointPosition = $(this).data('position');

            if (lineWidth > pointPosition) {

                var pointOffset = pointPosition + pointWidth;

                if (lineWidth < pointOffset) {

                    var slide = $('#' + $(this).data('slide'));
                    slide.siblings().removeClass('slide-point');
                    slide.addClass('slide-point');

                    var nav = $('#' + $(this).data('dots'));
                    nav.siblings().removeClass('dots-point');
                    nav.addClass('dots-point');

                }

            }

        });
    }


});