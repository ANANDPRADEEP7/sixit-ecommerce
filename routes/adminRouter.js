const express=require("express")
const router=express.Router();
const adminController=require("../controllers/admin/adminController");

// const { route } = require("./userRouter");
const customerController=require("../controllers/admin/customerController")

const categoryController=require("../controllers/admin/categoryController")

const brandController=require("../controllers/admin/brandController");

const productController=require("../controllers/admin/productController");

const orderController = require("../controllers/admin/orderController");

const couponController=require("../controllers/admin/couponController");

const salesController = require("../controllers/admin/salesController");

const {userAuth,adminAuth}=require("../middlewares/auth")

const multer=require("multer");

const storage=require("../helpers/multer");

const uploads=multer({storage:storage})


// ==========================================
//Error Management
router.get("/pageerror",adminController.pageerror)
//Login Management
router.get("/login",adminController.loadLogin);
router.post("/login",adminController.login);
router.get("/",adminAuth,adminController.loadDashboard);
router.get("/logout",adminController.logout);
// Customers Management
router.get("/users",adminAuth,customerController.customerInfo);
router.get("/blockCustomer",adminAuth,customerController.customerBlocked);
router.get("/unblockCustomer",adminAuth,customerController.customerunBlocked);
//category management
router.get("/category",adminAuth,categoryController.categoryInfo);
router.post("/addCategory",adminAuth,categoryController.addCategory)
router.get("/listCategory",adminAuth,categoryController.getListCategory);
router.get("/unlistCategory",adminAuth,categoryController.getUnListCategory);
router.get("/editCategory",adminAuth,categoryController.getEditCategory);
router.post("/editCategory/:id",adminAuth,categoryController.editCategory);

// Product Offer Routes
router.post('/addProductOffer', adminAuth, productController.addProductOffer);
router.post('/removeProductOffer', adminAuth, productController.removeProductOffer);

// Category Offer Routes
router.post('/addCategoryOffer', adminAuth, categoryController.addCategoryOffer);
router.post('/removeCategoryOffer', adminAuth, categoryController.removeCategoryOffer);

router.post("/addCategoryOffer",adminAuth,categoryController.addCategoryOffer);
router.post("/removeCategoryOffer",adminAuth,categoryController.removeCategoryOffer);

// Brand management
router.get("/brands",adminAuth,brandController.getBrandpage);
router.post("/addBrand",adminAuth,uploads.single("image"),brandController.addBrand);
router.get("/blockBrand",adminAuth,brandController.blockBrand);
router.get("/unBlockBrand",adminAuth,brandController.unBlockBrand);
router.get("/deleteBrand",adminAuth,brandController.deleteBrand);
// Product Management
router.get("/addProducts",adminAuth,productController.getProductAddPage);
router.post("/addProducts",adminAuth,uploads.array("images",4),productController.addProducts)
router.get("/products",adminAuth,productController.getAllProducts);
router.get("/blockProduct",adminAuth,productController.blockProduct);
router.get("/unblockProduct",adminAuth,productController.unblockProduct);
router.get("/editProduct",adminAuth,productController.getEditProduct);
router.post("/editProduct/:id",adminAuth,uploads.array("images",4),productController.editProduct);
router.post("/deleteImage",adminAuth,productController.deleteSingleImage);
//router.post("/updateproduct",adminAuth,productController.updateproduct);

router.post("/addProductOffer",adminAuth,productController.addProductOffer);
router.post("/removeProductOffer",adminAuth,productController.removeProductOffer);

// order Management
router.get("/orderList",adminAuth,orderController.orderList);
router.get("/orderView/:orderId",adminAuth,orderController.orderView);
router.get("/orderEdit/:orderId",adminAuth,orderController.EditStatusPage);
router.post("/orderEdit/:orderId",adminAuth,orderController.EditStatus);

//coupen Management
router.get("/coupon", adminAuth, couponController.loadCoupon);
router.post("/createCoupon", adminAuth, couponController.createCoupon);
router.get("/editCoupon", adminAuth, couponController.editCoupon);
router.post("/updateCoupon", adminAuth, couponController.updateCoupon);
router.post("/deleteCoupon", adminAuth, couponController.deleteCoupon);

// Sales Report Routes
router.get('/sales-report', adminAuth, salesController.getSalesReport);
router.post('/generate-report', adminAuth, salesController.generateReport);
router.get('/download-report/:type', adminAuth, salesController.downloadReport);

module.exports = router;