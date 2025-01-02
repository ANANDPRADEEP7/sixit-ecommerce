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


const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await User.findOne({ email, isAdmin: true });

    if (!admin) {
      console.log("Admin not found");
      return res.redirect("/admin/login");
    }

    const passwordMatch = await bcrypt.compare(password, admin.password);
    
    if (passwordMatch) {
      req.session.admin = admin;
      return res.redirect("/admin");
    }
    
    console.log("Password doesn't match");
    return res.redirect("/admin/login");

  } catch (error) {
    console.error("Login error:", error);
    return res.redirect("/admin/pageerror");
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