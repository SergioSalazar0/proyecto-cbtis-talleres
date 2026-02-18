/*---------------------------------------------------------------------
    File Name: custom.js - Versión Corregida
---------------------------------------------------------------------*/

$(function () {

    "use strict";

    /* Preloader */
    setTimeout(function () {
        $('.loader_bg').fadeToggle();
    }, 1500);

    /* JQuery Menu */
    $(document).ready(function () {
        if ($.isFunction($.fn.meanmenu)) {
            $('header nav').meanmenu();
        }
    });

    /* Tooltip */
    $(document).ready(function () {
        if ($.isFunction($.fn.tooltip)) {
            $('[data-toggle="tooltip"]').tooltip();
        }
    });

    /* sticky */
    $(document).ready(function () {
        if ($.isFunction($.fn.sticky)) {
            $(".sticky-wrapper-header").sticky({ topSpacing: 0 });
        }
    });

    /* Mouseover */
    $(document).ready(function () {
        $(".main-menu ul li.megamenu").mouseover(function () {
            if (!$(this).parent().hasClass("#wrapper")) {
                $("#wrapper").addClass('overlay');
            }
        });
        $(".main-menu ul li.megamenu").mouseleave(function () {
            $("#wrapper").removeClass('overlay');
        });
    });

    /* NiceScroll */
    if ($.isFunction($.fn.niceScroll)) {
        $(".brand-box").niceScroll({
            cursorcolor: "#9b9b9c",
        });
    }

    /* NiceSelect */
    $(document).ready(function () {
        if ($.isFunction($.fn.niceSelect)) {
            $('select').niceSelect();
        }
    });

    /* OwlCarousel - Blog Post slider */
    $(document).ready(function () {
        if ($.isFunction($.fn.owlCarousel)) {
            var owl = $('.carousel-slider-post');
            owl.owlCarousel({
                items: 1,
                loop: true,
                margin: 10,
                autoplay: true,
                autoplayTimeout: 3000,
                autoplayHoverPause: true
            });
        }
    });

    /* OwlCarousel - Banner Rotator Slider */
    $(document).ready(function () {
        if ($.isFunction($.fn.owlCarousel)) {
            var owl = $('.banner-rotator-slider');
            owl.owlCarousel({
                items: 1,
                loop: true,
                margin: 10,
                nav: true,
                dots: false,
                navText: ["<i class='fa fa-angle-left'></i>", "<i class='fa fa-angle-right'></i>"],
                autoplay: true,
                autoplayTimeout: 3000,
                autoplayHoverPause: true
            });
        }
    });

    /* OwlCarousel - Product Slider */
    $(document).ready(function () {
        if ($.isFunction($.fn.owlCarousel)) {
            var owl = $('#product-in-slider');
            owl.owlCarousel({
                loop: true,
                nav: true,
                margin: 10,
                navText: ["<i class='fa fa-angle-left'></i>", "<i class='fa fa-angle-right'></i>"],
                responsive: {
                    0: { items: 1 },
                    600: { items: 2 },
                    960: { items: 3 },
                    1200: { items: 4 }
                }
            });
            owl.on('mousewheel', '.owl-stage', function (e) {
                if (e.deltaY > 0) {
                    owl.trigger('next.owl');
                } else {
                    owl.trigger('prev.owl');
                }
                e.preventDefault();
            });
        }
    });

    /* Scroll to Top */
    $(window).on('scroll', function () {
        var scroll = $(window).scrollTop();
        if (scroll >= 100) {
            $("#back-to-top").addClass('b-show_scrollBut')
        } else {
            $("#back-to-top").removeClass('b-show_scrollBut')
        }
    });
    
    $("#back-to-top").on("click", function () {
        $('body,html').animate({
            scrollTop: 0
        }, 1000);
    });

    /* Contact-form */
    // Solo se ejecuta si el plugin de validación está cargado
    if ($.isFunction($.fn.validate)) {
        $.validator.setDefaults({
            submitHandler: function () {
                alert("submitted!");
            }
        });

        $("#contact-form").validate({
            rules: {
                firstname: "required",
                email: { required: true, email: true },
                lastname: "required",
                message: "required",
                agree: "required"
            },
            messages: {
                firstname: "Please enter your firstname",
                email: "Please enter a valid email address",
                lastname: "Please enter your lastname",
                message: "Please enter your Message",
                agree: "Please accept our policy"
            },
            errorElement: "div",
            errorPlacement: function (error, element) {
                error.addClass("help-block");
                if (element.prop("type") === "checkbox") {
                    error.insertAfter(element.parent("input"));
                } else {
                    error.insertAfter(element);
                }
            }
        });
    }

    /* heroslider */
    if (typeof Swiper !== 'undefined') {
        var swiper = new Swiper('.heroslider', {
            spaceBetween: 30,
            centeredSlides: true,
            slidesPerView: 'auto',
            loop: true,
            autoplay: {
                delay: 2500,
                disableOnInteraction: false,
            },
            pagination: {
                el: '.swiper-pagination',
                clickable: true,
            },
        });
    }

    /* Fancybox */
    if ($.isFunction($.fn.fancybox)) {
        $(".fancybox").fancybox({
            maxWidth: 1200,
            maxHeight: 600,
            width: '70%',
            height: '70%',
        });
    }

    /* Toggle sidebar */
    $('#sidebarCollapse').on('click', function () {
        $('#sidebar').toggleClass('active');
        $(this).toggleClass('active');
    });

});