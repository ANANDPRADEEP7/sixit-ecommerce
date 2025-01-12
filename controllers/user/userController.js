
const User=require("../../models/userSchema")
const Category=require("../../models/categorySchema");
const Product=require("../../models/productSchema");
const Brand=require("../../models/brandSchema");
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
    productData=productData.slice(0,12);

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


    const hashed = await  securePassword(password);

    const otp=generateOtp();
   
    
    const emailSend=await sendVerificationEmail(email,otp);
    if(!emailSend){
      return res.json("email-error")
    }

    req.session.userOtp=otp;
    req.session.userData={name,phone,email,password:hashed}

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

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log("email", email);
    console.log("password", password);
    
    const findUser = await User.findOne({ isAdmin: 0, email: email });
    console.log("find user", findUser);

    if (!findUser) {
      return res.render("login", { message: "User not found" });
    }

    if (findUser.isBlocked) {
      return res.render("login", { message: "User is blocked by admin" });
    }

    const passwordMatch = await bcrypt.compare(password, findUser.password);

    if (!passwordMatch) {
      return res.render("login", { message: "Incorrect Password" });
    }

    // If login successful
    req.session.user = findUser._id;
    return res.redirect("/");

  } catch (error) {
    console.log("login error", error);
 
    return res.render("login", { message: "Login failed. Please try again later" });
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

const loadShoppingPage=async (req,res)=>{
  try {
    const user=req.session.user;
    const userData=await User.findOne({_id:user});
    const categories= await Category.find({isListed:true});
    const categoryIds=categories.map((category)=>category._id.toString());
    const page=parseInt(req.query.page)||1;
    const limit=9;
    const skip=(page-1)*limit;

    const products=await Product.find({
      isBlocked:false,
      category:{$in:categoryIds},
      quantity:{$gt:0},

    }).sort({createdOn:-1}).skip(skip).limit(limit);

    // console.log("products",products);

    const totalProducts=await Product.countDocuments({
      isBlocked:false,
      category:{$in:categoryIds},
      quantity:{$gt:0},
    });
    const totalPages=Math.ceil(totalProducts/limit);

    const brand=await Brand.find({isBlocked:false});
    const categoriesWithIds=categories.map(category=>({_id:category._id,name:category.name}));

    res.render("shop",{
      user:userData,
      products:products,
      category:categoriesWithIds,
      brand:brand,
      totalProducts:totalProducts,
      currentPage:page,
      totalPages:totalPages
    })
  } catch (error) {
    res.redirect("/pageNotFound")
  }
}
const filterProduct=async (req,res)=>{
  try {
    const user=req.session.user;
    const category=req.query.category;
    const brand=req.query.brand;
    const findCategory=category ? await Category.findOne({_id:category}):null;
    const findBrand=brand? await Brand.findOne({_id:brand}):null;
    const brands=await Brand.find({}).lean();
    const query={
      isBlocked:false,
      quantity:{$gt:0}
    }
    if(findCategory){
      query.category=findCategory._id;
    }
    if(findBrand){
      query.brand=findBrand.brandName;
    }
    let findProducts=await Product.find(query).lean();
    findProducts.sort((a,b)=>new Date(b.createdOn)-new Date(a.createdOn));

    const categories=await Category.find({isListed:true});

    let itemsPerPage=6;

    let currentPage=parseInt(req.query.page)||1;
    let startIndex=(currentPage-1)* itemsPerPage;
    let endIndex=startIndex+itemsPerPage;
    let totalPages=Math.ceil(findProducts.length/itemsPerPage);
    const currentProduct=findProducts.slice(startIndex,endIndex);
    let userData=null;
    if(user){
      userData=await User.findOne({_id:user});
      if(userData){
        const searchEntry={
          category:findCategory ? findCategory._id:null,
          brand:findBrand ? findBrand.brandName:null,
          searchedOn:new Date(),
        }
        userData.searchHistory.push(searchEntry);
        await userData.save();
      }
    }
    console.log("onulla",currentProduct);

   // res.session.filteredProducts=currentProduct;

    res.render('shop',{
      user:userData,
      products:currentProduct,
      category:categories,
      brand:brands,
      totalPages,
      currentPage,
      selectedCategory:category||null,
      selectedBrand:brand||null,
    })

  } catch (error) {
    res.redirect("/pageNotFound");
    console.error("error",error);
  }
}

const filterByPrice = async (req, res) => {
  try {
    const user = req.session.user;
    const sort = req.query.sort;
    const userData = await User.findOne({ _id: user });
    const brands = await Brand.find({}).lean();
    const categories = await Category.find({ isListed: true }).lean();
    
    let findProducts;
    // Apply price sorting
    if (sort === 'lowToHigh') {
      findProducts = await Product.find({ isBlocked: false })
        .sort({ salePrice: 1 })
        .lean();
    } else if (sort === 'highToLow') {
      findProducts = await Product.find({ isBlocked: false })
        .sort({ salePrice: -1 })
        .lean();
    } else {
      findProducts = await Product.find({ isBlocked: false })
        .sort({ createdOn: -1 })
        .lean();
    }

    // Pagination
    const itemsPerPage = 6;
    const currentPage = parseInt(req.query.page) || 1;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const totalPages = Math.ceil(findProducts.length / itemsPerPage);
    const currentProduct = findProducts.slice(startIndex, endIndex);

    req.session.filterProduct = findProducts;
    
    res.render("shop", {
      user: userData,
      products: currentProduct,
      category: categories,
      brand: brands,
      totalPages,
      currentPage,
    });
  } catch (error) {
    console.error("Error in price filtering:", error);
    res.redirect("/pageNotFound");
  }
};


const searchProducts=async (req,res)=>{
  try {
    const user=req.session.user;
    const userData=await User.findOne({_id:user});
    let search=req.body.query;
    console.log('asdfgh',search);

    const brands=await Brand.find({}).lean();
    const categories=await Category.find({isListed:true}).lean();
    const categoryIds=categories.map(category=>category._id.toString());
    let searchResult=[];
    if(req.session.filterProducts&&req.session.filteredProducts.length>0){
      searchResult=req.session.filteredProducts.filter(product=>
        product.productName.toLowerCase().includes(search.toLowerCase)
      )
    }else{
        searchResult=await Product.find({
        productName:{$regex:".*"+search+".*",$options:"i"},
        isBlocked:false,
        quantity:{$gt:0},
        category:{$in:categoryIds}
        
      })
    }
    console.log('kitti',searchResult);
    searchResult.sort((a,b)=>new Date(b.createdOn)-new Date(a.createdOn));
    let itemsPerPage=6;
    let currentPage=parseInt(req.query.page)||1;
    let startIndex=(currentPage-1)*itemsPerPage;
    let endIndex=startIndex+itemsPerPage;
    let totalPages=Math.ceil(searchResult.length/itemsPerPage);
    const currentProduct=searchResult.slice(startIndex,endIndex);
    res.render("shop",{
      user:userData,
      products:currentProduct,
      category:categories,
      brand:brands,
      totalPages,
      currentPage,
      count:searchResult.leangth,
    });
   } catch (error) {
    console.log("Error:",error);
    res.redirect("/pageNotFound")
  }
}
const filterByName = async (req, res) => {
  try {
    const user = req.session.user;
    const order = req.query.sort;
    const userData = await User.findById(user._id);
    const brands = await Brand.find({}).lean();
    const categories = await Category.find({ isListed: true }).lean();
    const categoryListed = categories.map(category => category._id);

    let products;
    const baseQuery = {
      isBlocked: false,
      category: { $in: categoryListed }
    };

    if (order === "aA-zZ") {
      products = await Product.find(baseQuery)
        .collation({ locale: 'en' })
        .sort({ productName: 1 })
        .lean();
    } else if (order === "zZ-aA") {
      products = await Product.find(baseQuery)
        .collation({ locale: 'en' })
        .sort({ productName: -1 })
        .lean();
    } else {
      products = await Product.find(baseQuery)
        .sort({ createdOn: -1 })
        .lean();
    }

    // Pagination
    const itemsPerPage = 6; 
    const currentPage = parseInt(req.query.page) || 1;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const totalPages = Math.ceil(products.length / itemsPerPage);
    const currentProducts = products.slice(startIndex, endIndex);

    res.render("shop", {
      user: userData,
      products: currentProducts,
      category: categories,
      brand: brands,
      currentPage,
      totalPages
    });
  } catch (error) {
    console.error("Error in name filtering:", error);
    res.redirect("/pageNotFound");
  }
};

module.exports={
  lodeHomepage,
  loadSignup,
  signup,
  verifyOtp,
  resendOtp,
  loadLogin,
  pageNotFound,
  login,
  logout,
  loadShoppingPage,
  filterProduct,
  filterByPrice,
  searchProducts,
  filterByName
}

