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
    console.log(id, "id");
    const { categoryName, description } = req.body;
    console.log(categoryName, "categoryName");
    console.log(description, "description");

    const existingCategory = await Category.findOne({ name: categoryName });
    console.log(existingCategory, "existingcategory");

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

        // Check if any products in this category have product offers
        const products = await Product.find({ category: categoryId });
        const productsWithOffers = products.filter(product => product.productOffer > 0);
        
        if (productsWithOffers.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: "Cannot add category offer when products have individual offers" 
            });
        }

        // Add the category offer
        category.categoryOffer = percentage;
        await category.save();

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

        // Remove the category offer
        category.categoryOffer = 0;
        await category.save();

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
