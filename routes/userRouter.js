const express=require('express')
const router=express.Router()
const userController=require('../controllers/user/userController');
const passport = require('passport');
const productController=require('../controllers/user/productController');
const {userAuth}=require("../middlewares/auth")


router.get("/pageNotFound",userController.pageNotFound)
router.get('/', userController.lodeHomepage);
router.get('/signup',userController.loadSignup);
router.post('/signup',userController.signup);
router.post('/verify-otp',userController.verifyOtp);
router.post('/resend-otp',userController.resendOtp);
// router.get('/userProfile',userAuth,profileController.postNewPassword);


//product Management
router.get('/productDetails',userAuth,productController.productDetails)




router.get('/auth/google',passport.authenticate('google',{scope:['profile','email']}));
router.get("/auth/google/callback",passport.authenticate('google',{failureRedirect:'/signup'}),(req,res)=>{
  req.session.user=req.session.passport.user
  res.redirect('/')
});
//login Management
router.get('/login',userController.loadLogin)
router.post("/login",userController.login)
router.get("/logout",userController.logout);



module.exports=router; 