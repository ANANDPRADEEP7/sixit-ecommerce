const User=require("../../models/userSchema")
const Category=require("../../models/categorySchema");
const Product=require("../../models/productSchema");
const Brand=require("../../models/brandSchema");
const nodemailer=require("nodemailer");  
const bcrypt=require("bcrypt") 
const env=require("dotenv").config();  
const Coupon = require("../../models/couponSchema");
const Order = require("../../models/orderSchema");
const Cart = require("../../models/cartSchema");



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
    ).populate('category')

    productData.sort((a,b)=>new Date(b.createdOn)-new Date(a.createdOn));
    productData=productData.slice(0,12);

    // Calculate ratings and offers for each product
    productData = productData.map(product => {
      const productObj = product.toObject();
      
      // Calculate average rating
      const reviews = product.reviews || [];
      let averageRating = 0;
      if (reviews.length > 0) {
        const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
        averageRating = sum / reviews.length;
      }
      productObj.averageRating = averageRating;
      productObj.reviewCount = reviews.length;

      // Calculate effective offer
      const categoryOffer = product.category ? product.category.categoryOffer || 0 : 0;
      const productOffer = product.productOffer || 0;
      productObj.effectiveOffer = Math.max(categoryOffer, productOffer);
      
      if (productObj.effectiveOffer > 0) {
        const discount = (productObj.regularPrice * productObj.effectiveOffer) / 100;
        productObj.salePrice = Math.floor(productObj.regularPrice - discount);
      }

      return productObj;
    });


    if(user){
     const userData=await User.findOne({_id:user})
     const cart = await Cart.findOne({ userId: user }).populate("items.productId");
     const cartItems = cart ? cart.items.filter(item => {
       const product = item.productId;
       return (
         product.isBlocked === false && 
         categories.some(cat => cat._id.toString() === product.category.toString())
       );
     }) : [];
     
 
     res.render("home",{user:userData, products:productData, cart: cartItems});
    }else{
      return res.render('home',{products:productData})
    }
  } catch (error) {
  
    res.redirect("/pageNotFound")
  }
}

const loadSignup=async(req,res)=>{
  try {
    return res.render('signup')
  } catch (error) {
   
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

    res.render("verify-otp");
    console.log("OTP Send",otp);

  }catch(error){
    console.error("signup error",error)
    res.redirect("/pageNotFound")
  }
}


const aboutPage = async(req,res)=>{
  const userId = req.session.user;
  const user = await User.findById(userId);
  res.render('user/about',{user});

  }
  const contactPage = async(req,res)=>{
    const userId = req.session.user;
    const user = await User.findById(userId);
    res.render('user/contact',{user});
  }

const verifyOtp=async (req,res)=>{
  try {
    const {otp}=req.body;
    console.log("body otp",otp);

    if(otp===req.session.userOtp){
      console.log("session otp",req.session.userOtp);
      
      const user=req.session.userData;
      const hashedPassword = await bcrypt.hash(user.password, 10);

      const saveUserData= new User({
        name:user.name,
        email:user.email,
        phone:user.phone,
        password:hashedPassword,
        isAdmin: false,
        isBlocked: false
      });

      await saveUserData.save();
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

const loadShoppingPage=async(req,res)=>{
  try {
    const userId=req.session.user;
    const userData=await User.findById(userId);
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    const categories=await Category.find({isListed:true});
    const brands=await Brand.find({isListed:true});

    const cartItems = cart ? cart.items.filter(item => {
      const product = item.productId;
      return (
        product.isBlocked === false && 
        categories.some(cat => cat._id.toString() === product.category.toString())
      );
    }) : [];

    const page = parseInt(req.query.page) || 1;
    const limit = 12;
    const skip = (page - 1) * limit;

    let products = await Product.find({
      isBlocked: false,
      category: { $in: categories.map(category => category._id) },
      quantity: { $gt: 0 }
    })
      .populate({
        path: "category",
        select: "name categoryOffer" // Explicitly select the fields we need
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Calculate effective offer for each product
    products = products.map(product => {
      const productObj = product.toObject();
      
      // Get category offer from populated category
      const categoryOffer = product.category ? product.category.categoryOffer || 0 : 0;
      const productOffer = product.productOffer || 0;
      
      // Set effective offer
      productObj.effectiveOffer = Math.max(categoryOffer, productOffer);
      
      // Calculate discounted price based on effective offer
      if (productObj.effectiveOffer > 0) {
        const discount = (productObj.regularPrice * productObj.effectiveOffer) / 100;
        productObj.salePrice = Math.floor(productObj.regularPrice - discount);
      }

      
      
      return productObj;
    });

    const totalProducts = await Product.countDocuments({
      isBlocked: false,
      category: { $in: categories.map(category => category._id) },
      quantity: { $gt: 0 }
    });

    const totalPages = Math.ceil(totalProducts / limit);

    res.render("shop", {
      user: userData,
      products,
      categories,
      brands,
      cart: cartItems,
      currentPage: page,
      totalPages,
      pages: Array.from({ length: totalPages }, (_, i) => i + 1)
    });

  } catch (error) {
    console.log("Error in loading shopping page:", error);
    res.redirect("/pageNotFound");
  }
}

const filterProduct=async (req,res)=>{
  try {
    const user=req.session.user;
    const category=req.query.category;
    const brand=req.query.brand;
    const sort=req.query.sort;
    const userData=await User.findById(user);
    const findCategory=category ? await Category.findOne({_id:category}):null;
    const findBrand=brand? await Brand.findOne({_id:brand}):null;
    const brands=await Brand.find({}).lean();
    const categories=await Category.find({isListed:true}).lean();
    const categoryListed=categories.map(category=>category._id);

    const query={
      isBlocked:false,
      category:{$in:categoryListed},
      quantity:{$gt:0}
    };

    if(findCategory){
      query.category=findCategory._id;
    }

    if(findBrand){
      query.brand=findBrand.name;
    }

    let findProducts=await Product.find(query).lean();

    if(userData && userData.wishlist){
      findProducts=findProducts.map(product=>({
        ...product,
        isInWishlist:userData.wishlist.some(id=>id.toString()===product._id.toString())
      }));
    }

    if(sort){
      switch(sort){
        case 'newest':
          findProducts.sort((a,b)=>new Date(b.createdOn)-new Date(a.createdOn));
          break;
        case 'priceHigh':
          findProducts.sort((a,b)=>b.salePrice-a.salePrice);
          break;
        case 'priceLow':
          findProducts.sort((a,b)=>a.salePrice-b.salePrice);
          break;
        case 'nameAsc':
          findProducts.sort((a,b)=>{
            const nameA=a.productName.toLowerCase().trim();
            const nameB=b.productName.toLowerCase().trim();
            return nameA<nameB?-1:nameA>nameB?1:0;
          });
          break;
        case 'nameDesc':
          findProducts.sort((a,b)=>{
            const nameA=a.productName.toLowerCase().trim();
            const nameB=b.productName.toLowerCase().trim();
            return nameB<nameA?-1:nameB>nameA?1:0;
          });
          break;
      }
    }else{
      findProducts.sort((a,b)=>new Date(b.createdOn)-new Date(a.createdOn));
    }

    const itemsPerPage=6;
    const currentPage=parseInt(req.query.page)||1;
    const startIndex=(currentPage-1)*itemsPerPage;
    const endIndex=startIndex+itemsPerPage;
    const totalPages=Math.ceil(findProducts.length/itemsPerPage);
    const currentProduct=findProducts.slice(startIndex,endIndex);

    const cart = await Cart.findOne({ userId: user }).populate("items.productId");
    const cartItems = cart ? cart.items.filter(item => {
      const product = item.productId;
      return (
        product.isBlocked === false && 
        categoryListed.includes(product.category.toString())
      );
    }) : [];

    res.render("shop",{
      user:userData,
      products:currentProduct,
      category:categories,
      brand:brands,
      totalPages,
      currentPage,
      sortBy:sort||null,
      cart: cartItems
    });

  } catch (error) {
    console.log("Error in filtering products:",error);
    res.redirect("/pageNotFound");
  }
};

const filterByPrice=async(req,res)=>{
  try {
    const user = req.session.user;
    const maxPrice = parseInt(req.query.price) || 100000;
    const sort = req.query.sort;
    const userData = await User.findById(user);
    const brands = await Brand.find({}).lean();
    const categories = await Category.find({ isListed: true }).lean();
    const categoryListed = categories.map(category => category._id);

    let findProducts = await Product.find({
      isBlocked: false,
      category: { $in: categoryListed },
      quantity: { $gt: 0 },
      salePrice: { $lte: maxPrice }
    }).lean();

    if (userData && userData.wishlist) {
      findProducts = findProducts.map(product => ({
        ...product,
        isInWishlist: userData.wishlist.some(id => id.toString() === product._id.toString())
      }));
    }

    if (sort) {
      switch (sort) {
        case 'newest':
          findProducts.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));
          break;
        case 'priceHigh':
          findProducts.sort((a, b) => b.salePrice - a.salePrice);
          break;
        case 'priceLow':
          findProducts.sort((a, b) => a.salePrice - b.salePrice);
          break;
        case 'nameAsc':
          findProducts.sort((a, b) => {
            const nameA = a.productName.toLowerCase().trim();
            const nameB = b.productName.toLowerCase().trim();
            return nameA < nameB ? -1 : nameA > nameB ? 1 : 0;
          });
          break;
        case 'nameDesc':
          findProducts.sort((a, b) => {
            const nameA = a.productName.toLowerCase().trim();
            const nameB = b.productName.toLowerCase().trim();
            return nameB < nameA ? -1 : nameB > nameA ? 1 : 0;
          });
          break;
      }
    } else {
      findProducts.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));
    }

    const itemsPerPage = 6;
    const currentPage = parseInt(req.query.page) || 1;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const totalPages = Math.ceil(findProducts.length / itemsPerPage);
    const currentProduct = findProducts.slice(startIndex, endIndex);

    const cart = await Cart.findOne({ userId: user }).populate("items.productId");
    const cartItems = cart ? cart.items.filter(item => {
      const product = item.productId;
      return (
        product.isBlocked === false && 
        categoryListed.includes(product.category.toString())
      );
    }) : [];

    res.render("shop", {
      user: userData,
      products: currentProduct,
      category: categories,
      brand: brands,
      totalPages,
      currentPage,
      sortBy: sort || null,
      maxPrice,
      cart: cartItems
    });

  } catch (error) {
    console.log("Error in filtering by price:", error);
    res.redirect("/pageNotFound");
  }
};

const searchProducts = async (req, res) => {
  try {
    const user = req.session.user;
    const searchQuery = req.body.search;

    if (!searchQuery || searchQuery.trim().length === 0) {
      return res.redirect('/shop');
    }

    const userData = await User.findById(user);
    const brands = await Brand.find({}).lean();
    const categories = await Category.find({ isListed: true }).lean();
    const categoryListed = categories.map(category => category._id);

    let findProducts = await Product.find({
      isBlocked: false,
      category: { $in: categoryListed },
      quantity: { $gt: 0 },
      $or: [
        { productName: { $regex: searchQuery, $options: 'i' } },
        { description: { $regex: searchQuery, $options: 'i' } },
        { brand: { $regex: searchQuery, $options: 'i' } }
      ]
    }).lean();

    if (userData && userData.wishlist) {
      findProducts = findProducts.map(product => ({
        ...product,
        isInWishlist: userData.wishlist.some(id => id.toString() === product._id.toString())
      }));
    }

    const itemsPerPage = 6;
    const currentPage = parseInt(req.query.page) || 1;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const totalPages = Math.ceil(findProducts.length / itemsPerPage);
    const currentProduct = findProducts.slice(startIndex, endIndex);

    const cart = await Cart.findOne({ userId: user }).populate("items.productId");
    const cartItems = cart ? cart.items.filter(item => {
      const product = item.productId;
      return (
        product.isBlocked === false && 
        categoryListed.includes(product.category.toString())
      );
    }) : [];

    res.render("shop", {
      user: userData,
      products: currentProduct,
      category: categories,
      brand: brands,
      totalPages,
      currentPage,
      cart: cartItems
    });

  } catch (error) {
    console.log("Error in searching products:", error);
    res.redirect("/pageNotFound");
  }
};

const filterByName = async (req, res) => {
  try {
    const user = req.session.user;
    const order = req.query.sort;
    const userData = await User.findById(user);
    const brands = await Brand.find({}).lean();
    const categories = await Category.find({ isListed: true }).lean();
    const categoryListed = categories.map(category => category._id);

    let findProducts = await Product.find({
      isBlocked: false,
      category: { $in: categoryListed },
      quantity: { $gt: 0 }
    }).lean();

    if (userData && userData.wishlist) {
      findProducts = findProducts.map(product => ({
        ...product,
        isInWishlist: userData.wishlist.some(id => id.toString() === product._id.toString())
      }));
    }

    if (order === 'nameAsc') {
      findProducts.sort((a, b) => {
        const nameA = a.productName.toLowerCase().trim();
        const nameB = b.productName.toLowerCase().trim();
        return nameA < nameB ? -1 : nameA > nameB ? 1 : 0;
      });
    } else if (order === 'nameDesc') {
      findProducts.sort((a, b) => {
        const nameA = a.productName.toLowerCase().trim();
        const nameB = b.productName.toLowerCase().trim();
        return nameB < nameA ? -1 : nameB > nameA ? 1 : 0;
      });
    }

    const itemsPerPage = 6;
    const currentPage = parseInt(req.query.page) || 1;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const totalPages = Math.ceil(findProducts.length / itemsPerPage);
    const currentProduct = findProducts.slice(startIndex, endIndex);

    const cart = await Cart.findOne({ userId: user }).populate("items.productId");
    const cartItems = cart ? cart.items.filter(item => {
      const product = item.productId;
      return (
        product.isBlocked === false && 
        categoryListed.includes(product.category.toString())
      );
    }) : [];

    res.render("shop", {
      user: userData,
      products: currentProduct,
      category: categories,
      brand: brands,
      totalPages,
      currentPage,
      sortBy: order || null,
      cart: cartItems
    });

  } catch (error) {
    console.log("Error in filtering by name:", error);
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
  applyCoupon,
  contactPage ,
  aboutPage
}
