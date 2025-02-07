function updateCounts() {
    fetch('/get-counts')
        .then(response => response.json())
        .then(data => {
            const wishlistCount = document.querySelector('.header-action-icon-2 .pro-count:first-of-type');
            const cartCount = document.querySelector('.mini-cart-icon .pro-count');

            if (data.wishlistCount > 0) {
                wishlistCount.textContent = data.wishlistCount;
                wishlistCount.style.display = 'inline-block';
            } else {
                wishlistCount.style.display = 'none';
            }

            if (data.cartCount > 0) {
                cartCount.textContent = data.cartCount;
                cartCount.style.display = 'inline-block';
            } else {
                cartCount.style.display = 'none';
            }
        })
        .catch(error => console.error('Error updating counts:', error));
}

// Update counts when page loads
document.addEventListener('DOMContentLoaded', updateCounts);

// Update counts every 5 seconds
setInterval(updateCounts, 5000);
