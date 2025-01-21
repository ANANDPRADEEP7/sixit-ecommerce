const express=require('express')
const router=express.Router()
const userController=require('../controllers/user/userController');
const passport = require('passport');
const productController=require('../controllers/user/productController');
const {userAuth}=require("../middlewares/auth")
const profileController = require('../controllers/user/profileController');
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




//product Management
router.get('/productDetails',userAuth,productController.productDetails)
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
router.get("/change-password",profileController.changePassword);
router.post("/change-password",profileController.changePasswordValid)
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
router.post("/return-product", userAuth, returnProduct);

// checkout Management
router.get("/checkOut",userAuth,checkoutController.checkOutPage);
router.post("/check-out-addaddress",userAuth,checkoutController.checkOutAddress);
router.get("/orderComform",userAuth,checkoutController.orderComform);
router.post("/checkout",userAuth,checkoutController.postCheckout);

// wishlist Management
router.get("/wishlist",userAuth,wishlistController.loadWishlist);
router.post("/addToWishlist",userAuth,wishlistController.addToWishlist);
router.get('/removeFromWishlist',userAuth,wishlistController.removeProduct)

// coupon Management
router.post('/applyCoupon', userAuth, userController.applyCoupon);

module.exports=router; 