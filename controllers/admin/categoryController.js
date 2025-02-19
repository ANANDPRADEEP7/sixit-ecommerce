const Category = require("../../models/categorySchema");
const Product=require("../../models/productSchema");

const categoryInfo = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;

    const categoryData = await Category.find({});
    const totalCategories = await Category.countDocuments();
    const totalPages = Math.ceil(totalCategories / limit);
    res.render("category", {
      cat: categoryData,
      currentPage: page,
      totalPages: totalPages,
      totalCategories: totalCategories,
    });
  } catch (error) {
    console.error(error);
    res.redirect("/pageerror");
  }
};

const addCategory = async (req, res) => {
  const { name, description } = req.body;
  try {
    const existingCategory = await Category.findOne({
      name: { $regex: name, $options: "i" },
    });
    if (existingCategory) {
      return res.status(400).json({success:false, message: "category already exists" });
    }
    const newCategory = new Category({
      name,
      description,
    });
    await newCategory.save();
    // return res.json({success :true,redirectUrl:"/category",message:"category added successfully"})
    return res.status(200).json({success:true,message:"Category successfully added."});
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const getListCategory = async (req, res) => {
  try {
    let id = req.query.id;
    await Category.updateOne({ _id: id }, { $set: { isListed: false } });
    res.redirect("/admin/category");
  } catch (error) {
    res.redirect("pageerror");
  }
};
const getUnListCategory = async (req, res) => {
  try {
    let id = req.query.id;
    await Category.updateOne({ _id: id }, { $set: { isListed: true } });
    res.redirect("/admin/category");
  } catch (error) {
    res.redirect("pageerror");
  }
};

const getEditCategory = async (req, res) => {
  try {
    const id = req.query.id;
    const category = await Category.findOne({ _id: id });
    res.render("editCategory", { category: category });
  } catch (error) {
    res.redirect("/pageerror");
  }
};

const editCategory = async (req, res) => {
  try {
    let id = req.params.id;
  
    const { categoryName, description } = req.body;
  

    const existingCategory = await Category.findOne({ name: categoryName });


    if (existingCategory) {
      return res
        .status(400)
        .json({ error: "Category exists, please choose another name" });
    }

    const updateCategory = await Category.findByIdAndUpdate(
      id,
      {
        name: categoryName,
        description: description,
      },
      { new: true }
    );

    if (updateCategory) {
      res.redirect("/admin/category");
    } else {
      res.status(404).json({ error: "Category not found" });
    }
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

const addCategoryOffer = async (req, res) => {
    try {
        const percentage = parseInt(req.body.percentage);
        const categoryId = req.body.categoryId;

        if (!categoryId || !percentage) {
            return res.status(400).json({ success: false, message: "Category ID and percentage are required" });
        }

        // Validate percentage
        if (isNaN(percentage) || percentage < 1 || percentage > 99) {
            return res.status(400).json({ 
                success: false, 
                message: "Offer percentage must be between 1 and 99" 
            });
        }

        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(404).json({ success: false, message: "Category not found" });
        }

        // Save category offer
        category.categoryOffer = percentage;
        await category.save();

        // Get all products in this category
        const products = await Product.find({ category: categoryId });
        
        // Update each product's effective offer
        for (const product of products) {
            const productOffer = product.productOffer || 0;
            product.effectiveOffer = Math.max(percentage, productOffer);

            // Calculate new sale price based on effective offer
            if (product.effectiveOffer > 0) {
                const discount = (product.regularPrice * product.effectiveOffer) / 100;
                product.salePrice = Math.floor(product.regularPrice - discount);
            }

            await product.save();
        }

        // Log for debugging
      
        return res.json({ success: true, message: "Category offer added successfully" });
    } catch (error) {
        console.error("Error in addCategoryOffer:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

const removeCategoryOffer = async (req, res) => {
    try {
        const { categoryId } = req.body;
        if (!categoryId) {
            return res.status(400).json({ success: false, message: "Category ID is required" });
        }

        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(404).json({ success: false, message: "Category not found" });
        }

        // Remove category offer
        category.categoryOffer = 0;
        await category.save();

        // Update all products in this category
        const products = await Product.find({ category: categoryId });
        
        for (const product of products) {
            // Set effective offer to product offer (if exists)
            product.effectiveOffer = product.productOffer || 0;

            // Update sale price based on effective offer
            if (product.effectiveOffer > 0) {
                const discount = (product.regularPrice * product.effectiveOffer) / 100;
                product.salePrice = Math.floor(product.regularPrice - discount);
            } else {
                product.salePrice = product.regularPrice;
            }

            await product.save();
        }


        return res.json({ success: true, message: "Category offer removed successfully" });
    } catch (error) {
        console.error("Error in removeCategoryOffer:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

module.exports = {
  categoryInfo,
  addCategory,
  getListCategory,
  getUnListCategory,
  getEditCategory,
  editCategory,
  addCategoryOffer,
  removeCategoryOffer
};
