const User = require('../../models/userSchema');
const mongoose=require("mongoose")
const bcrypt=require("bcrypt")



const pageerror=async(req,res)=>{
  res.render("pageerror")
}


const loadLogin= (req,res)=>{
    if(req.session.admin){
      return res.redirect("/admin/dashboard")
    }
    res.render("adminlogin",{message:null})    
}


const login=async (req,res)=>{
  try {
    const {email,password}=req.body;
    console.log(email);
    const admin=await User.findOne({email,isAdmin:true});
    if(admin){
      const passwordMarch=bcrypt.compare(password,admin.password)
      if(passwordMarch){
        req.session.admin=true;
        return res.redirect("/admin")
      }else{
        console.log("password is match");
        return res.redirect("/login")
      }
    }else{
      console.log("Admin not found");
      return res.redirect("/login")
    }
  } catch (error) {
    console.log("login error",error);
    return res.redirect("/pageerror")
  }
};

const loadDashboard=async (req,res)=>{
  if(req.session.admin){
    try {
      res.render("dashboard")
    } catch (error) {
      res.redirect("/pageerror")
    }
  }
}

const logout=async(req,res)=>{
  try{
    req.session.destroy(err=>{
      if(err){
        console.log("Error detsroying sesion",err);
        return res.redirect("/pageerror")
      }
      res.redirect("/admin/login")
    })
  }catch(error){
    console.log(("Unexpeted error during logout",error));
    res.redirect("pageerror")
  }
}


module.exports={
  loadLogin,
  login,
  loadDashboard,
  pageerror,
  logout
}