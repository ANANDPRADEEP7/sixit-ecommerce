const Product = require("../../models/productSchema");
const Category=require("../../models/categorySchema");
const Brand=require("../../models/brandSchema");
const User=require("../../models/userSchema");
const fs=require("fs");
const path=require("path");
const sharp=require("sharp")


const getProductAddPage=async (req,res)=>{
  try{
  const category=await Category.find({isListed:true});
  const brand=await Brand.find({isBlocked:false});
  const msg=req.query.msg || null;
  res.render("product-add",{
    cat:category,
    brand:brand,
    msg
  })
}catch(error){
  res.redirect("/pageerror")
}
}

const addProducts=async (req,res)=>{
  try {
    const products=req.body;

    const requiredFields = ['productName', 'description', 'brand', 'regularPrice', 'quantity'];
        for (const field of requiredFields) {
            if (!products[field]) {
                return res.status(400).json({
                    success: false,
                    message: `${field} is required`
                });
            }
        }
        const productExists = await Product.findOne({
          productName: { $regex: new RegExp(`^${products.productName}$`, 'i') }
      });

    
    if(!productExists){
      const images=[]

      if(req.files&& req.files.length>0){
        for(let i=0;i<req.files.length;i++){
          const originalImagePath=req.files[i].path;

          const resizedImagePath=path.join('public','uploads','re-image',req.files[i].filename);
         
          images.push(req.files[i].filename);
        }
      }
      const categoryId=await Category.findOne({name:products.category});

      // if(!categoryId){
      //   return res.redirect("/admin/addproducts?msg=this category ")
      // }
      const newProduct= Product.create({
        productName:products.productName,
        description:products.description,
        brand:products.brand,
        category:categoryId._id,
        regularPrice:products.regularPrice,
        salePrice:products.salePrice,
        createdOn: new Date(),
        quantity:products.quantity,
        size:products.size,
        color:products.color,
        productImage:images,
        status:"Available",
      });

      
      return res.redirect("/admin/addProducts");
    }else{
      return res.status(400).json({success:false, message:"product already exist"});
    }
  } catch (error) {
    console.error("Error saving product",error.message);
    return res.redirect("/admin/pageerror")
  }
}

const calculateFinalPrice = (product) => {
    let finalPrice = product.salePrice;
    
    // Apply product offer if exists
    if (product.productOffer) {
        finalPrice = finalPrice - (finalPrice * product.productOffer / 100);
    }
    
    // Apply category offer if exists and is better than product offer
    if (product.category && product.category.categoryOffer) {
        const categoryDiscountedPrice = product.salePrice - (product.salePrice * product.category.categoryOffer / 100);
        finalPrice = Math.min(finalPrice, categoryDiscountedPrice);
    }
    
    return Math.round(finalPrice);
};

const getAllProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 8;
    const skip = (page - 1) * limit;

    let query = {};
    if (req.query.search) {
        query = {
            $or: [
                { productName: { $regex: req.query.search, $options: 'i' } },
                { brand: { $regex: req.query.search, $options: 'i' } }
            ]
        };
    }

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limit);

    const products = await Product.find(query)
        .populate('category')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });

    // Calculate final prices for all products
    const productsWithPrices = products.map(product => {
        const finalPrice = calculateFinalPrice(product);
        return {
            ...product.toObject(),
            finalPrice
        };
    });

    res.render('admin/products', {
        data: productsWithPrices,
        totalPages,
        currentPage: page,
        search: req.query.search || ''
    });
  } catch (error) {
    console.error('Error in getAllProducts:', error);
    res.status(500).render('error', { message: 'Error loading products' });
  }
};

const blockProduct=async(req,res)=>{
  try {
    let id=req.query.id;
    await Product.updateOne({_id:id},{$set:{isBlocked:true}});
    res.redirect("/admin/products")
  } catch (error) {
    res.redirect("/pageerror")
  }
}
const unblockProduct=async(req,res)=>{
  try {
    let id=req.query.id;
    await Product.updateOne({_id:id},{$set:{isBlocked:false}});
    res.redirect("/admin/products")
  } catch (error) {
    res.redirect("/pageerror")
  }
}

const getEditProduct=async(req,res)=>{
  try {
    const id=req.query.id;
    const product=await Product.findOne({_id:id});
    const category=await Category.find({});
    const brand=await Brand.find({});
    res.render("edit-product",{
      product:product,
      cat:category,
      brand:brand,
    })
  } catch (error) {
    res.redirect("/pageerror")
  }
};


const editProduct = async (req, res) => {
  try {
    const id = req.params.id;
    console.log(id);
    const product = await Product.findById(id);
    console.log(product)
    if (!product) {
      return res.status(404).json({ error: "Product not found!" });
    }

   
    const updateData = {
      productName: req.body.productName || product.productName,
      description: req.body.description || product.description,
      regularPrice: req.body.regularPrice || product.regularPrice,
      salePrice: req.body.salePrice || product.salePrice,
      quantity: req.body.quantity || product.quantity,
      color: req.body.color || product.color,
       category:req.body.category||product.category,
    };

  
    if (req.body.category) {
      console.log(req.body.category);
      const category = await Category.findOne({ name: req.body.category });
      console.log(category);
      if (!category) {
        return res.status(400).json({ error: "Invalid category!" });
      }
      updateData.category = category._id; 
    } else {
      updateData.category = product.category; 
    }

    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(file => file.filename);
      updateData.productImage = [
        ...product.productImage, 
        ...newImages
      ];
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      id, 
      { $set: updateData }, 
      { new: true }
    );


    if (!updatedProduct) {
      return res.status(500).json({ error: "Failed to update product", product: updatedProduct });
    }

    // res.status(200).json({success:true, message: "Product updated successfully!",    product: updatedProduct  });
    res.redirect("/admin/products")

  } catch (error) {
    console.error("Full error in editproduct:", error);
    res.status(500).json({  error: "Something went wrong!",  details: error.message 
  });
  }
};


const deleteSingleImage = async (req, res) => {
  try {
    const { imageNameToServer, productIdToServer } = req.body;

    // Find and update product
    const product = await Product.findByIdAndUpdate(
      productIdToServer,
      { $pull: { productImage: imageNameToServer } },
      { new: true }
    );

    if (!product) {
      return res.status(404).send({ status: false, message: "Product not found" });
    }

    // Build the image path
    const imagePath = path.join(
      __dirname,
      "..",
      "public",
      "uploads",
      "re-image",
      imageNameToServer
    );

  
    fs.access(imagePath, fs.constants.F_OK, (err) => {
      if (!err) {
        fs.unlink(imagePath, (unlinkErr) => {
          if (unlinkErr) {
            console.error(`Error deleting image ${imageNameToServer}:`, unlinkErr);
          } else {
            console.log(`Image ${imageNameToServer} deleted successfully`);
          }
        });
      } else {
        console.log(`Image ${imageNameToServer} not found`);
      }
    });

    res.send({ status: true });
  } catch (error) {
    console.error("Error in deleteSingleImage:", error.message);
    res.status(500).json({ status: false, message: error.message });
  }
};

const addProductOffer = async (req, res) => {
    try {
        const { productId, percentage } = req.body;
        if (!productId || !percentage) {
            return res.status(400).json({ success: false, message: "Product ID and percentage are required" });
        }

        const product = await Product.findById(productId).populate('category');
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        // Check if category has an offer
        if (product.category && product.category.categoryOffer > 0) {
            return res.status(400).json({ 
                success: false, 
                message: "Cannot add product offer when category offer exists" 
            });
        }

        // Validate percentage
        const offerPercentage = parseInt(percentage);
        if (isNaN(offerPercentage) || offerPercentage < 1 || offerPercentage > 99) {
            return res.status(400).json({ 
                success: false, 
                message: "Offer percentage must be between 1 and 99" 
            });
        }

        // Calculate new sale price with offer
        const discountAmount = Math.floor(product.regularPrice * (offerPercentage / 100));
        const newSalePrice = product.regularPrice - discountAmount;

        // Update product with offer
        product.productOffer = offerPercentage;
        product.salePrice = newSalePrice;
        await product.save();

        return res.json({ success: true, message: "Product offer added successfully" });
    } catch (error) {
        console.error("Error in addProductOffer:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

const removeProductOffer = async (req, res) => {
    try {
        const { productId } = req.body;
        if (!productId) {
            return res.status(400).json({ success: false, message: "Product ID is required" });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        // Reset the sale price to regular price and remove offer
        product.salePrice = product.regularPrice;
        product.productOffer = 0;
        await product.save();

        return res.json({ success: true, message: "Product offer removed successfully" });
    } catch (error) {
        console.error("Error in removeProductOffer:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

module.exports={
  getProductAddPage,
  addProducts,
  getAllProducts,
  blockProduct,
  unblockProduct,
  getEditProduct,
  editProduct,
  deleteSingleImage,
  addProductOffer,
  removeProductOffer
}