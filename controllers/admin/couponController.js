const Coupon = require("../../models/couponSchema");

const loadCoupon = async (req, res) => {
  try {
    const coupons = await Coupon.find();
    res.render("admin/coupon", { coupons });
  } catch (error) {
    console.error("Error loading coupons:", error);
    res.status(500).send("Internal Server Error");
  }
};

const createCoupon = async (req, res) => {
  try {
    const { couponName, startDate, endDate, offerPrice, minimumPrice } = req.body;

    const newCoupon = new Coupon({
      name: couponName,
      createdOn: startDate,
      expireOn: endDate,
      offerPrice: offerPrice,
      minimumPrice: minimumPrice,
      isListed: true
    });

    await newCoupon.save();
    res.redirect("/admin/coupon");
  } catch (error) {
    console.error("Error creating coupon:", error);
    res.status(500).json({ success: false, message: "Failed to create coupon" });
  }
};

const editCoupon = async (req, res) => {
  try {
    const id = req.query.id;
    if (!id) {
      console.error("No coupon ID provided");
      return res.status(400).send("Coupon ID is required");
    }

    const findCoupon = await Coupon.findById(id);
    
    if (!findCoupon) {
      console.error("Coupon not found with ID:", id);
      return res.status(404).send("Coupon not found");
    }

    res.render("admin/edit-coupon", { findCoupon });
  } catch (error) {
    console.error("Error loading edit coupon page:", error);
    res.status(500).send("Internal Server Error");
  }
};

const updateCoupon = async (req, res) => {
  try {
    const { couponId, couponName, startDate, endDate, offerPrice, minimumPrice } = req.body;

    if (!couponId) {
      return res.status(400).json({
        success: false,
        message: "Coupon ID is required"
      });
    }

    const updatedCoupon = await Coupon.findByIdAndUpdate(
      couponId,
      {
        name: couponName,
        createdOn: startDate,
        expireOn: endDate,
        offerPrice: offerPrice,
        minimumPrice: minimumPrice
      },
      { new: true }
    );

    if (!updatedCoupon) {
      console.error("Coupon not found for update:", couponId);
      return res.status(404).json({
        success: false,
        message: "Coupon not found"
      });
    }

    res.json({
      success: true,
      message: "Coupon updated successfully"
    });
  } catch (error) {
    console.error("Error updating coupon:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update coupon"
    });
  }
};

const deleteCoupon = async (req, res) => {
  try {
    const { couponId } = req.body;
    
    
    if (!couponId) {
      console.error("No coupon ID provided for deletion");
      return res.status(400).json({ 
        success: false, 
        message: "Coupon ID is required" 
      });
    }

    const deletedCoupon = await Coupon.findByIdAndDelete(couponId);
    
    if (!deletedCoupon) {
      console.error("Coupon not found for deletion:", couponId);
      return res.status(404).json({ 
        success: false, 
        message: "Coupon not found" 
      });
    }

    res.status(200).json({
      success: true,
      message: "Coupon deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting coupon:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete coupon"
    });
  }
};

module.exports = {
  loadCoupon,
  createCoupon,
  editCoupon,
  updateCoupon,
  deleteCoupon
};