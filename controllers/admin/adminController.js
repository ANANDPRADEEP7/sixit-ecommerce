const User = require('../../models/userSchema');
const mongoose=require("mongoose")
const bcrypt=require("bcrypt")



const pageerror=async(req,res)=>{
  try {
    res.render('admin/pageerror');
  } catch (error) {
    console.error('Error in pageerror:', error);
    res.status(500).send('Internal Server Error');
  }
}


const loadLogin= async (req,res)=>{
  try {
    if (req.isAuthenticated() && req.user.role === 'admin') {
      res.redirect('/admin');
    } else {
      res.render('admin/adminlogin');
    }
  } catch (error) {
    console.error('Error in loadLogin:', error);
    res.status(500).send('Internal Server Error');
  }
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
  try {
    res.render('admin/dashboard');
  } catch (error) {
    console.error('Error in loadDashboard:', error);
    res.status(500).send('Internal Server Error');
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