
const User=require("../../models/userSchema")
const Category=require("../../models/categorySchema");
const Product=require("../../models/productSchema");
const nodemailer=require("nodemailer");  
const bcrypt=require("bcrypt") 
const env=require("dotenv").config();  



const pageNotFound=async (req,res)=>{
  try {
    res.render("page-404")
  } catch (error) {
    res.redirect("/pageNotFound")
  }
}

const lodeHomepage=async(req,res)=>{
  try {
    const user=req.session.user;
    const categories=await Category.find({isListed:true});
    let productData=await Product.find(
      {isBlocked:false,
        category:{$in:categories.map(category=>category._id)},quantity:{$gt:0}
      }
    )

    productData.sort((a,b)=>new Date(b.createdOn)-new Date(a.createdOn));
    productData=productData.slice(0,4);

    console.log(user);
    if(user){
     const userData=await User.findOne({_id:user})
     console.log(user);
     
     console.log(userData);
     console.log(productData);
     res.render("home",{user:userData,products:productData});
    }else{
      return res.render('home',{products:productData})
    }
   
    
  } catch (error) {
    console.log("Home page not found");
    console.log(error);
    res.status(500).send("Server error")
    
  }
}

const loadSignup=async(req,res)=>{
  try {
    return res.render('signup')
  } catch (error) {
    console.log('Home page not loading:',error);
    res.status(500).send("Server Error")
    
  }
}
// otp
function generateOtp(){
  return Math.floor(100000 + Math.random()*900000).toString();
}

async function sendVerificationEmail(email,otp){
  try {
    const transporter=nodemailer.createTransport({
      service:"gmail",
      port:587,
      secure:false,
      requireTLS:true,
      auth:{
        user:process.env.NODEMAILER_EMAIL,
        pass:process.env.NODEMAILER_PASSWORD
      }
    })
    const info=await transporter.sendMail({
      from:process.env.NODEMAILER_EMAIL,
      to:email,
      subject:"Verify your account",
      text:`Your otp is ${otp}`,
      html:`<b>Your OTP:${otp}</b>`,
    })

    return info.accepted.length>0


  } catch (error) {
    console.log("Error sending email",error);
    return false;
    
  }
}

const signup=async(req,res)=>{
  try{
    const {name,phone,email,password,confirmpassword}=req.body;
    if(password !== confirmpassword){
      return res.render("signup",{message:'Password do not match'})
    }
    const findUser=await User.findOne({email});
    if(findUser){
      return res.render("signup",{message:"user with this email already exists"})
    }
    const otp=generateOtp();
   
    
    const emailSend=await sendVerificationEmail(email,otp);
    if(!emailSend){
      return res.json("email-error")
    }

    req.session.userOtp=otp;
    req.session.userData={name,phone,email,password}

    res.render("Verify-otp");
    console.log("OTP Send",otp);
    

  }catch(error){
    console.error("signup error",error)
    res.redirect("/pageNotFound")

  }
}

const securePassword=async(password) => {
  try {
    const passwordHash=await bcrypt.hash(password,10)
    return passwordHash;
  } catch (error) {
    
  }
}

const verifyOtp=async (req,res)=>{
  try {
    const {otp}=req.body;
    console.log("body otp",otp);

    if(otp===req.session.userOtp){
      console.log("session otp",req.session.userOtp);
      
      const user=req.session.userData
      const passwordHash=await securePassword(user.password)

      const saveUserData= new User({
        name:user.name,
        email:user.email,
        phone:user.phone,
        password:passwordHash,
      })

      await saveUserData.save();
      // req.session.user=saveUserData._id;
      res.json({success:true,redirect:"/login"})
    }else{
      res.status(400).json({success:false,mesage:"Invalid OTP,please try again"})
    }
    
  } catch (error) {
    console.error("Error Verifying OTP",error)
    res.status(500).json({success:false,message:"An error occured"})
  }
}

const resendOtp=async (req,res)=>{
  try {
    const {email}=req.session.userData;
    console.log(req.session.userData);
    if(!email){
      return res.status(400).json({success:false,message:"Email not found in session"})
    }
    const otp=generateOtp()
      req.session.userOtp=otp;

      const emailSend=await sendVerificationEmail(email,otp);
      if(emailSend){
        console.log("Resend OTP:",otp);
        res.status(200).json({success:true,message:"OTP Resend Successfully"});

      }else{
        res.status(500).json({success:false,message:"Failed to resend OTP.plrase try again"})
      }
    
  } catch (error) {
    console.log("Error resending OTP",error);
    res.status(500).json({success:false,message:"Internal server error.plrase try again"})
  }
}

const loadLogin=async (req,res)=>{
  try {
    if(!req.session.user){
      return res.render("login")
    }else{
      res.redirect("/")
    }
  } catch (error) {
    res.redirect("/pageNotFound")
    
  }
}

const login=async (req,res)=>{
  try {
    const {email,password}=req.body;
    console.log("email",email);
    
    const findUser=await User.findOne({isAdmin:0,email:email});
    console.log("find user",findUser)
    if(!findUser){
     return res.render("login",{message:"User not found"})
    }
    if(findUser.isBlocked){
    return res.render("login",{message:"User is blocked by admin"})
    }
    const passwordMatch=await bcrypt.compare(password,findUser.password);

    if(!password){
      return res.render("login",{message:"Incorrect Password"})
    }

    req.session.user=findUser._id;
    res.redirect("/");
  } catch (error) {
    console.log("login error",error);
    res.render("login",{mesage:"login failed.please later"})
    
  }

}

const logout=async (req,res)=>{
  try {
    req.session.destroy((err)=>{
      if(err){
        console.log("session destruction error",err.message);
        return res.redirect("/pageNotFound");
      }
      return res.redirect("/login")
    })
  } catch (error) {
    console.log("Logout error",error);
    res.redirect("/pageNotFound")
  }
}

module.exports={
  lodeHomepage,
  loadSignup,
  signup,
  verifyOtp,
  resendOtp,
  loadLogin,
  pageNotFound,
  login,
  logout
}

