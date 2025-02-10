(function ($) {
    'use strict';
    /*Product Details*/
    var productDetails = function () {
        $('.product-image-slider').slick({
            slidesToShow: 1,
            slidesToScroll: 1,
            arrows: false,
            fade: false,
            asNavFor: '.slider-nav-thumbnails',
        });

        $('.slider-nav-thumbnails').slick({
            slidesToShow: 5,
            slidesToScroll: 1,
            asNavFor: '.product-image-slider',
            dots: false,
            focusOnSelect: true,
            prevArrow: '<button type="button" class="slick-prev"><i class="fi-rs-angle-left"></i></button>',
            nextArrow: '<button type="button" class="slick-next"><i class="fi-rs-angle-right"></i></button>'
        });

        // Remove active class from all thumbnail slides
        $('.slider-nav-thumbnails .slick-slide').removeClass('slick-active');

        // Set active class to first thumbnail slides
        $('.slider-nav-thumbnails .slick-slide').eq(0).addClass('slick-active');

        // On before slide change match active thumbnail to current slide
        $('.product-image-slider').on('beforeChange', function (event, slick, currentSlide, nextSlide) {
            var mySlideNumber = nextSlide;
            $('.slider-nav-thumbnails .slick-slide').removeClass('slick-active');
            $('.slider-nav-thumbnails .slick-slide').eq(mySlideNumber).addClass('slick-active');
        });

        $('.product-image-slider').on('beforeChange', function (event, slick, currentSlide, nextSlide) {
            var img = $(slick.$slides[nextSlide]).find("img");
            $('.zoomWindowContainer,.zoomContainer').remove();
            $(img).elevateZoom({
                zoomType: "inner",
                cursor: "crosshair",
                zoomWindowFadeIn: 500,
                zoomWindowFadeOut: 750
            });
        });
        //Elevate Zoom
        if ( $(".product-image-slider").length ) {
            $('.product-image-slider .slick-active img').elevateZoom({
                zoomType: "inner",
                cursor: "crosshair",
                zoomWindowFadeIn: 500,
                zoomWindowFadeOut: 750
            });
        }
        //Filter color/Size
        $('.list-filter').each(function () {
            $(this).find('a').on('click', function (event) {
                event.preventDefault();
                $(this).parent().siblings().removeClass('active');
                $(this).parent().toggleClass('active');
                $(this).parents('.attr-detail').find('.current-size').text($(this).text());
                $(this).parents('.attr-detail').find('.current-color').text($(this).attr('data-color'));
            });
        });
        //Qty Up-Down
        $('.detail-qty').each(function () {
            var $this = $(this);
            var $qtyVal = $this.find('.qty-val');
            
            $this.find('.qty-up').on('click', function (event) {
                event.preventDefault();
                var productId = $(this).data('product-id');
                var currentQty = parseInt($qtyVal.text(), 10);
                
                if (currentQty >= 5) {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Maximum Limit Reached',
                        text: 'You can only purchase up to 5 items of this product',
                        confirmButtonText: 'OK'
                    });
                    return;
                }
                
                updateCartQuantity(productId, currentQty + 1, $qtyVal);
            });
            
            $this.find('.qty-down').on('click', function (event) {
                event.preventDefault();
                var productId = $(this).data('product-id');
                var currentQty = parseInt($qtyVal.text(), 10);
                
                if (currentQty > 1) {
                    updateCartQuantity(productId, currentQty - 1, $qtyVal);
                }
            });
        });

        function updateCartQuantity(productId, newQty, $qtyElement) {
            $.ajax({
                url: '/update-cart-quantity',
                method: 'POST',
                data: {
                    productId: productId,
                    quantity: newQty
                },
                success: function(response) {
                    if (response.success) {
                        $qtyElement.text(newQty);
                        
                        // Update the total price
                        var pricePerItem = $('#total-' + productId).data('price');
                        var newTotal = pricePerItem * newQty;
                        $('#total-' + productId).text('₹' + Math.floor(newTotal));
                        
                        // Show success message
                        if (newQty === 5) {
                            Swal.fire({
                                icon: 'info',
                                title: 'Maximum Quantity Reached',
                                text: 'You have reached the maximum quantity limit for this item',
                                confirmButtonText: 'OK'
                            });
                        }
                    } else {
                        Swal.fire({
                            icon: 'error',
                            title: 'Error',
                            text: response.message || 'Failed to update quantity',
                            confirmButtonText: 'OK'
                        });
                    }
                },
                error: function() {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'Failed to update quantity. Please try again.',
                        confirmButtonText: 'OK'
                    });
                }
            });
        }

        $('.dropdown-menu .cart_list').on('click', function (event) {
            event.stopPropagation();
        });
    };
    /* WOW active */
    new WOW().init();

    //Load functions
    $(document).ready(function () {
        productDetails();
    });

})(jQuery);