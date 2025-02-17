const express=require('express')
const router=express.Router()
const userController=require('../controllers/user/userController');
const passport = require('passport');
const productController=require('../controllers/user/productController');
const {userAuth}=require("../middlewares/auth")
const profileController = require('../controllers/user/profileController');
const walletController = require("../controllers/user/walletController");
const {
    getCart,
    addToCart,
    removeProduct,
    updateCartQuantity,
    cancelOrder,
    cancelEntireOrder,
    returnProduct
} = require("../controllers/user/cartController");
const checkoutController=require("../controllers/user/checkoutController");
const wishlistController=require("../controllers/user/wishlistController");
const Cart = require('../models/cartSchema');
const User = require('../models/userSchema');

// Error Management
router.get("/pageNotFound",userController.pageNotFound)
// signup Management
router.get('/auth/google',passport.authenticate('google',{scope:['profile','email']}));
router.get("/auth/google/callback",passport.authenticate('google',{failureRedirect:'/signup'}),(req,res)=>{
  req.session.user=req.session.passport.user
  res.redirect('/')
});
router.get('/signup',userController.loadSignup);
router.post('/signup',userController.signup);
router.post('/verify-otp',userController.verifyOtp);
router.post('/resend-otp',userController.resendOtp);
// Home Page & Shoping Page
router.get('/', userController.lodeHomepage);
router.get("/shop",userAuth,userController.loadShoppingPage);
router.get('/filter',userAuth,userController.filterProduct);
router.get("/filterPrice",userAuth,userController.filterByPrice);
router.post("/search",userAuth,userController.searchProducts);
router.get("/filterByName",userAuth,userController.filterByName)  


// About page route
router.get("/about",userAuth,userController.aboutPage);


// Contact page route
router.get("/contact",userController.contactPage);

//product Management
router.get('/productDetails',userAuth,productController.productDetails)
router.post('/product/:productId/review', userAuth, productController.submitReview)
//login Management
router.get('/login',userController.loadLogin)
router.post("/login",userController.login)
router.get("/logout",userController.logout);
//Profile Management
router.get('/forgot-password',profileController.getForgotPassPage);
router.post("/forgot-email-valid",profileController.forgotEmailValid);
router.post('/verify-passForgot-otp',profileController.verifyForgotPassOtp);
router.get('/reset-password',profileController.getResetPassPage);  
router.post('/resend-forgot-otp',profileController.resendOtp)
router.post('/reset-password',profileController.postNewPassword);
router.get('/userProfile',profileController.userProfile);
router.get('/order-details/:orderId', userAuth, profileController.getOrderDetails);
router.post('/update-password', userAuth, profileController.updatePassword);
router.get("/change-password",profileController.changePassword);
router.post("/verify-changepassword-otp",profileController.verifyChangepassotp)



// Address Management
router.get('/addAddress',userAuth,profileController.addAddress)
router.post('/addAddress',userAuth,profileController.postAddAddress)
router.get('/editAddress',userAuth,profileController.editAddress);
router.post('/editAddress',userAuth,profileController.postEditAddress);
router.get("/deleteAddress",userAuth,profileController.deleteAddress);

// Cart Management
router.get("/getCart",userAuth,getCart);
router.post('/addToCart',userAuth,addToCart);
router.get("/removeFromCart",userAuth,removeProduct);
router.post("/updateCartQuantity",userAuth,updateCartQuantity);
router.post('/orders/:orderId/product/:productId/cancel', userAuth, cancelOrder);
router.post('/orders/:orderId/cancel', userAuth, cancelEntireOrder);
router.post('/orders/:orderId/product/:productId/return', userAuth, returnProduct);

// Wallet Management
router.post('/add-money-to-wallet', userAuth, walletController.addMoneyToWallet);
router.post('/verify-wallet-payment', userAuth, walletController.verifyWalletPayment);

// Razorpay payment routes
router.post('/create-razorpay-order', userAuth, checkoutController.createRazorpayOrder);
router.post('/verify-payment', userAuth, checkoutController.verifyPayment);
router.post('/retry-payment', userAuth, checkoutController.retryPayment);
router.post('/verify-retry-payment', userAuth, checkoutController.verifyRetryPayment);

// Payment failed route
router.get('/payment-failed', userAuth, (req, res) => {
    const error = req.query.error || 'Payment could not be processed';
    res.render('user/paymentFailed', { error });
});

// checkout Management
router.get("/checkOut",userAuth,checkoutController.checkOutPage);
router.post("/check-out-addaddress",userAuth,checkoutController.checkOutAddress);
router.post("/apply-coupon", userAuth, checkoutController.applyCoupon);
router.post("/remove-coupon", userAuth, checkoutController.removeCoupon);
router.get("/orderComform",userAuth,checkoutController.orderComform);
router.post("/checkout",userAuth,checkoutController.postCheckout);

// wishlist Management
router.get("/wishlist",userAuth,wishlistController.loadWishlist);
router.post("/add-to-wishlist",userAuth,wishlistController.addToWishlist);
router.get('/removeFromWishlist',userAuth,wishlistController.removeProduct)

// coupon Management
router.post('/applyCoupon', userAuth, userController.applyCoupon);

// Profile Management
router.get('/profile',userAuth,profileController.getProfilePage)
router.get('/api/orders', userAuth, profileController.getOrdersData);
router.get('/editProfile',userAuth,profileController.getEditProfilePage)
router.post('/editProfile',userAuth,profileController.editProfile)
router.get('/address',userAuth,profileController.getAddressPage)
router.post('/address',userAuth,profileController.addAddress)
router.get('/editAddress',userAuth,profileController.getEditAddressPage)
router.post('/editAddress',userAuth,profileController.editAddress)
router.get('/deleteAddress',userAuth,profileController.deleteAddress)
router.get('/orders',userAuth,profileController.getOrdersPage)
router.get('/order-details/:orderId',userAuth,profileController.getOrderDetails)
router.get('/download-invoice/:orderId', userAuth, profileController.downloadInvoice)
router.get('/api/orders', userAuth, profileController.getOrdersPage) // New API endpoint for AJAX pagination

// Filter products
router.get('/filter-products', userController.filterProducts);

// Product filters
// Uncomment the filter route in userRouter.js
router.get('/filter-by-category', userAuth, productController.filterByCategory);
// router.get('/filter-by-category', userAuth, productController.filterByCategory);
router.get('/filter-by-price', userAuth, userController.filterByPrice);

router.get('/get-counts', userAuth, async (req, res) => {
    try {
        const cart = await Cart.findOne({ userId: req.session.user });
        const user = await User.findById(req.session.user);
        
        res.json({
            cartCount: cart ? cart.items.length : 0,
            wishlistCount: user && user.wishlist ? user.wishlist.length : 0
        });
    } catch (error) {
        console.error('Error getting counts:', error);
        res.status(500).json({ error: 'Failed to get counts' });
    }
});

module.exports=router; 