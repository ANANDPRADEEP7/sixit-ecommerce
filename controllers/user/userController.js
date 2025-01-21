const User=require("../../models/userSchema")
const Category=require("../../models/categorySchema");
const Product=require("../../models/productSchema");
const Brand=require("../../models/brandSchema");
const nodemailer=require("nodemailer");  
const bcrypt=require("bcrypt") 
const env=require("dotenv").config();  
const Coupon = require("../../models/couponSchema");
const Order = require("../../models/orderSchema");



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
    const user = req.session.user;
    const sort = req.query.sort;
    const userData = await User.findOne({ _id: user });
    const brands = await Brand.find({}).lean();
    const categories = await Category.find({ isListed: true }).lean();
    
    // Find all unblocked products
    let findProducts = await Product.find({ 
      isBlocked: false 
    }).lean();

    // Apply sorting
    if(sort) {
      switch(sort) {
        case 'newest':
          findProducts.sort((a,b) => new Date(b.createdOn) - new Date(a.createdOn));
          break;
        case 'priceHigh':
          findProducts.sort((a,b) => b.salePrice - a.salePrice);
          break;
        case 'priceLow':
          findProducts.sort((a,b) => a.salePrice - b.salePrice);
          break;
        case 'nameAsc':
          findProducts.sort((a,b) => {
            const nameA = a.productName.toLowerCase().trim();
            const nameB = b.productName.toLowerCase().trim();
            return nameA < nameB ? -1 : nameA > nameB ? 1 : 0;
          });
          break;
        case 'nameDesc':
          findProducts.sort((a,b) => {
            const nameA = a.productName.toLowerCase().trim();
            const nameB = b.productName.toLowerCase().trim();
            return nameB < nameA ? -1 : nameB > nameA ? 1 : 0;
          });
          break;
      }
    } else {
      // Default sort by newest
      findProducts.sort((a,b) => new Date(b.createdOn) - new Date(a.createdOn));
    }

    // Pagination
    const itemsPerPage = 6;
    const currentPage = parseInt(req.query.page) || 1;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const totalPages = Math.ceil(findProducts.length / itemsPerPage);
    const currentProduct = findProducts.slice(startIndex, endIndex);

    res.render("shop", {
      user: userData,
      products: currentProduct,
      category: categories,
      brand: brands,
      totalPages,
      currentPage,
      sortBy: sort || null
    });
  } catch (error) {
    console.error("Error in loading shop page:", error);
    res.redirect("/pageNotFound");
  }
};

const filterProduct=async (req,res)=>{
  try {
    const user=req.session.user;
    const category=req.query.category;
    const brand=req.query.brand;
    const sort=req.query.sort;
    const findCategory=category ? await Category.findOne({_id:category}):null;
    const findBrand=brand? await Brand.findOne({_id:brand}):null;
    const brands=await Brand.find({}).lean();
    const categories=await Category.find({isListed:true}).lean();
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

    // Apply sorting
    if(sort) {
      switch(sort) {
        case 'newest':
          findProducts.sort((a,b) => new Date(b.createdOn) - new Date(a.createdOn));
          break;
        case 'priceHigh':
          findProducts.sort((a,b) => b.salePrice - a.salePrice);
          break;
        case 'priceLow':
          findProducts.sort((a,b) => a.salePrice - b.salePrice);
          break;
        case 'nameAsc':
          findProducts.sort((a,b) => {
            const nameA = a.productName.toLowerCase().trim();
            const nameB = b.productName.toLowerCase().trim();
            return nameA < nameB ? -1 : nameA > nameB ? 1 : 0;
          });
          break;
        case 'nameDesc':
          findProducts.sort((a,b) => {
            const nameA = a.productName.toLowerCase().trim();
            const nameB = b.productName.toLowerCase().trim();
            return nameB < nameA ? -1 : nameB > nameA ? 1 : 0;
          });
          break;
      }
    } else {
      // Default sort by newest
      findProducts.sort((a,b) => new Date(b.createdOn) - new Date(a.createdOn));
    }

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

    res.render('shop',{
      user:userData,
      products:currentProduct,
      category:categories,
      brand:brands,
      totalPages,
      currentPage,
      selectedCategory: category || null,
      sortBy: sort || null
    });

  } catch (error) {
    res.redirect("/pageNotFound");
    console.error("error",error);
  }
}

const filterByPrice = async (req, res) => {
  try {
    const user = req.session.user;
    const maxPrice = parseInt(req.query.price) || 100000;
    const sort = req.query.sort;
    const userData = await User.findOne({ _id: user });
    const brands = await Brand.find({}).lean();
    const categories = await Category.find({ isListed: true }).lean();
    
    // Find products within price range
    let findProducts = await Product.find({ 
      isBlocked: false,
      $or: [
        { salePrice: { $lte: maxPrice } },
        { regularPrice: { $lte: maxPrice } }
      ]
    }).lean();

    // Apply sorting
    if(sort) {
      switch(sort) {
        case 'newest':
          findProducts.sort((a,b) => new Date(b.createdOn) - new Date(a.createdOn));
          break;
        case 'priceHigh':
          findProducts.sort((a,b) => b.salePrice - a.salePrice);
          break;
        case 'priceLow':
          findProducts.sort((a,b) => a.salePrice - b.salePrice);
          break;
        case 'nameAsc':
          findProducts.sort((a,b) => {
            const nameA = a.productName.toLowerCase().trim();
            const nameB = b.productName.toLowerCase().trim();
            return nameA < nameB ? -1 : nameA > nameB ? 1 : 0;
          });
          break;
        case 'nameDesc':
          findProducts.sort((a,b) => {
            const nameA = a.productName.toLowerCase().trim();
            const nameB = b.productName.toLowerCase().trim();
            return nameB < nameA ? -1 : nameB > nameA ? 1 : 0;
          });
          break;
      }
    } else {
      // Default sort by price low to high for price filter
      findProducts.sort((a,b) => a.salePrice - b.salePrice);
    }

    // Pagination
    const itemsPerPage = 6; 
    const currentPage = parseInt(req.query.page) || 1;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const totalPages = Math.ceil(findProducts.length / itemsPerPage);
    const currentProduct = findProducts.slice(startIndex, endIndex);

    res.render("shop", {
      user: userData,
      products: currentProduct,
      category: categories,
      brand: brands,
      totalPages,
      currentPage,
      selectedPrice: maxPrice,
      sortBy: sort || null
    });
  } catch (error) {
    console.error("Error in price filtering:", error);
    res.redirect("/pageNotFound");
  }
};

const searchProducts=async (req,res)=>{
  try {
    const user = req.session.user;
    const searchQuery = req.query.query;
    const sort = req.query.sort;
    
    if (!searchQuery) {
      return res.redirect('/shop');
    }

    const userData = await User.findOne({ _id: user });
    const brands = await Brand.find({}).lean();
    const categories = await Category.find({ isListed: true }).lean();

    // Create case-insensitive search regex
    const searchRegex = new RegExp(searchQuery, 'i');

    // Search in product name and description
    const searchResult = await Product.find({
      isBlocked: false,
      $or: [
        { productName: searchRegex },
        { description: searchRegex },
        { brand: searchRegex }
      ]
    }).lean();

    // Apply sorting
    if(sort) {
      switch(sort) {
        case 'newest':
          searchResult.sort((a,b) => new Date(b.createdOn) - new Date(a.createdOn));
          break;
        case 'priceHigh':
          searchResult.sort((a,b) => b.salePrice - a.salePrice);
          break;
        case 'priceLow':
          searchResult.sort((a,b) => a.salePrice - b.salePrice);
          break;
        case 'nameAsc':
          searchResult.sort((a,b) => {
            const nameA = a.productName.toLowerCase().trim();
            const nameB = b.productName.toLowerCase().trim();
            return nameA < nameB ? -1 : nameA > nameB ? 1 : 0;
          });
          break;
        case 'nameDesc':
          searchResult.sort((a,b) => {
            const nameA = a.productName.toLowerCase().trim();
            const nameB = b.productName.toLowerCase().trim();
            return nameB < nameA ? -1 : nameB > nameA ? 1 : 0;
          });
          break;
      }
    } else {
      // Default sort by relevance (name match first, then description match)
      searchResult.sort((a, b) => {
        const aNameMatch = a.productName.toLowerCase().includes(searchQuery.toLowerCase());
        const bNameMatch = b.productName.toLowerCase().includes(searchQuery.toLowerCase());
        if (aNameMatch && !bNameMatch) return -1;
        if (!aNameMatch && bNameMatch) return 1;
        return new Date(b.createdOn) - new Date(a.createdOn);
      });
    }

    // Pagination
    const itemsPerPage = 6;
    const currentPage = parseInt(req.query.page) || 1;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const totalPages = Math.ceil(searchResult.length / itemsPerPage);
    const currentProduct = searchResult.slice(startIndex, endIndex);

    res.render('shop', {
      user: userData,
      products: currentProduct,
      category: categories,
      brand: brands,
      totalPages,
      currentPage,
      searchQuery,
      sortBy: sort || null,
      count: searchResult.length
    });
  } catch (error) {
    console.error("Error in search:", error);
    res.redirect("/pageNotFound");
  }
};

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

const applyCoupon = async (req, res) => {
  try {
    const { couponCode, totalAmount } = req.body;
    const userId = req.session.user;

    // Find the coupon
    const coupon = await Coupon.findOne({
      name: couponCode,
      isListed: true,
      expireOn: { $gt: new Date() },
      createdOn: { $lte: new Date() }
    });

    if (!coupon) {
      return res.json({
        success: false,
        message: "Invalid or expired coupon code"
      });
    }

    // Check if the total amount meets the minimum requirement
    if (totalAmount < coupon.minimumPrice) {
      return res.json({
        success: false,
        message: `Minimum purchase amount of ₹${coupon.minimumPrice} required to use this coupon`
      });
    }

    // Check if user has already used this coupon
    const order = await Order.findOne({
      user: userId,
      'coupon.code': couponCode
    });

    if (order) {
      return res.json({
        success: false,
        message: "You have already used this coupon"
      });
    }

    // Calculate discount
    const discountAmount = Math.min(coupon.offerPrice, totalAmount);

    res.json({
      success: true,
      coupon: {
        _id: coupon._id,
        name: coupon.name,
        offerPrice: discountAmount
      },
      message: "Coupon applied successfully"
    });

  } catch (error) {
    console.error("Error applying coupon:", error);
    res.status(500).json({
      success: false,
      message: "Failed to apply coupon"
    });
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
  filterByName,
  applyCoupon
}
