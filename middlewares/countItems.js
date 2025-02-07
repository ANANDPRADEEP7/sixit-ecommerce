const Cart = require("../models/cartSchema");
const User = require("../models/userSchema");

const countItems = async (req, res, next) => {
    try {
        if (req.session.user) {
            // Get cart count
            const cart = await Cart.findOne({ userId: req.session.user });
            const cartCount = cart ? cart.items.length : 0;

            // Get wishlist count from user model
            const user = await User.findById(req.session.user);
            const wishlistCount = user && user.wishlist ? user.wishlist.length : 0;

            // Add counts to res.locals to make them available in views
            res.locals.cartCount = cartCount;
            res.locals.wishlistCount = wishlistCount;
        } else {
            res.locals.cartCount = 0;
            res.locals.wishlistCount = 0;
        }
        next();
    } catch (error) {
        console.error("Error in countItems middleware:", error);
        res.locals.cartCount = 0;
        res.locals.wishlistCount = 0;
        next();
    }
};

module.exports = countItems;
