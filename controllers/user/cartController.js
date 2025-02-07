const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");
const Category = require('../../models/categorySchema');
const Order = require("../../models/orderSchema");
const { productDetails } = require("./productController");
const mongoose = require("mongoose");
const walletController = require('./walletController');

const getCart = async (req, res) => {
  try {
      const userId = req.session.user;

      const cart = await Cart.findOne({ userId }).populate("items.productId");
      const user = await User.findById(userId);
      const categories = await Category.find({ isListed: true });
      
      
      const listedCategory = categories.map(category => category._id.toString());

      const findProduct = cart.items.filter(item => {
          const product = item.productId;
          return (
              product.isBlocked === false && 
              listedCategory.includes(product.category.toString())
          );
      });

      res.render("cart", {
          user,
          cart: findProduct, 
      });
  } catch (error) {
      console.error("Error in showing cart page", error);
      res.redirect("/pageNotFound");
  }
};

const addToCart = async (req, res) => {
    try {
      const { productId } = req.body;
      const userId = req.session.user;
      const cartLimit = 5;
  
      // Fetch the product from the database
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ status: false, message: "Product not found" });
      }
  
      if (product.available_quantity <= 0) {
        return res.status(400).json({ status: false, message: "Product is out of stock!" });
      }
  
      // Find or create a cart for the user
      let cart = await Cart.findOne({ userId });
      if (!cart) {
        cart = new Cart({ userId, items: [] });
      }
  
      // Check if the product already exists in the cart
      const productInCart = cart.items.find((item) => item.productId.toString() === productId);
  
      if (productInCart) {
        // Update quantity and total price if product is already in the cart
        if (productInCart.quantity >= cartLimit) {
          return res.status(400).json({ status: false, message: "Maximum quantity reached for this product in the cart." });
        }
  
        const qtyToAdd = 1; // Default increment
        if (product.available_quantity < productInCart.quantity + qtyToAdd) {
          return res.status(400).json({ status: false, message: "Not enough stock to add more of this product." });
        }
  
        productInCart.quantity += qtyToAdd;
        productInCart.totalPrice = productInCart.price * productInCart.quantity;
      } else {
        // Add new product to the cart
        if (product.available_quantity < 1) {
          return res.status(400).json({ status: false, message: "Not enough stock to add this product to the cart." });
        }
  
        cart.items.push({
          productId,
          price: product.salePrice || product.price,
          totalPrice: product.salePrice || product.price,
          quantity: 1,
        });
      }
  
      // Save the cart
      await cart.save();
  
      // Return success response
      return res.status(200).json({ status: true, message: "Product added to cart successfully" });
    } catch (error) {
      console.error("Error adding to cart:", error);
      return res.status(500).json({ status: false, message: "An error occurred while adding to cart" });
    }
};

const removeProduct = async (req, res) => {
  try {
      const productId = req.query.productId;
      const userId = req.session.user;

   
      const cart = await Cart.findOne({ userId });
  

      if (!cart) {     
          return res.redirect("/cart");
      }

      const findProduct = cart.items.find((item)=> item.productId.toString() === productId)
   

      

      const removeQty = findProduct.quantity;

      cart.items = cart.items.filter((item) => item.productId.toString() !== productId);

   
      await cart.save();
      


      await Product.findByIdAndUpdate(productId,{$inc:{quantity:removeQty}}) 
  
   

      return res.redirect("/getCart");
  } catch (error) {
      console.error("Error in removing item from cart", error);
      return res.status(500).json({ status: false, message: "Server Error!" });
  }
};

const updateCartQuantity = async(req,res)=>{
  try {
      const {productId, quantity} = req.body;
    
      
      const userId = req.session.user;
      const limit = 5;

      const cart = await Cart.findOne({userId});
      if(!cart){
          return res.status(404).json({status:false, message:"Cart not found..!"})
      }

      const product = await Product.findById(productId); // Find the product in the database
      if (!product) {
          return res.status(404).json({ status: false, message: "Product not found!" });
      }

    

      const findProduct = cart.items.find((item)=> item.productId.toString() === productId);
      if(!findProduct){
          return res.status(404).json({status:false, message:"Product not found in the cart..!"})
      }


   

      if(quantity > limit){
          return res.status(400).json({status:false, message:"Quantity not exceed 5."})
      }

      const qtyDefference = quantity - findProduct.quantity;

      if(qtyDefference > 0 && product.quantity < qtyDefference){
          return res.status(400).json({status:false, message:"Product out of stock..!"})
      }

      product.quantity -= qtyDefference;
      if(product.quantity <= 0){
          return res.status(400).json({status:false, message:"Insufficient stock..."})
      }
     
      findProduct.quantity = quantity;
      findProduct.totalPrice =  findProduct.price  * findProduct.quantity;

      await product.save();
      await cart.save();
      return res.status(200).json({status: true, message:"Cart updated succesfuly."})
  } catch (error) {
      console.error("Error in updating quantity",error);
      return res.status(500).json({status: false, message:"Server Error...!"})
  }
}

const cancelOrder = async (req, res) => {
  try {
    const { orderId, productId } = req.params;
    const userId = req.session.user;

    if (!mongoose.Types.ObjectId.isValid(orderId) || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: "Invalid orderId or productId." });
    }

    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found or does not belong to the user." });
    }

    const orderItem = order.orderedItems.find(
      item => item.id.toString() === productId
    );

    if (!orderItem) {
      return res.status(404).json({ success: false, message: "Product not found in order." });
    }

    if (orderItem.status === "Shipped" || orderItem.status === "Delivered") {
      return res.status(400).json({ success: false, message: "Cannot cancel order. Product has already been shipped or delivered." });
    }

    if (orderItem.status === "Cancelled") {
      return res.status(400).json({ success: false, message: "Product is already cancelled." });
    }

    // Calculate refund amount
    const refundAmount = orderItem.price * orderItem.quantity;

    // Update product status to Cancelled
    orderItem.status = "Cancelled";
    
    // Restore product quantity
    await Product.findByIdAndUpdate(
      productId,
      { $inc: { quantity: orderItem.quantity } }
    );

    // Save order first to ensure status is updated
    await order.save();

    // Credit the amount to wallet
    try {
      const walletResponse = await walletController.useWalletBalance(
        userId, 
        refundAmount, 
        `Amount credited for cancelled product from order #${orderId}`, 
        'credit'
      );
      
      if (!walletResponse.success) {
        console.error("Wallet credit failed:", walletResponse.message);
        return res.status(500).json({ 
          success: false, 
          message: "Failed to credit amount to wallet. Please contact support." 
        });
      }
    } catch (walletError) {
      console.error("Error crediting to wallet:", walletError);
      return res.status(500).json({ 
        success: false, 
        message: "Failed to credit amount to wallet. Please contact support." 
      });
    }

    return res.status(200).json({ 
      success: true, 
      message: "Product cancelled successfully and amount credited to wallet"
    });

  } catch (error) {
    console.error("Error canceling order:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Failed to cancel the order. Please try again later." 
    });
  }
};

const cancelEntireOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.session.user;


    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: "Invalid orderId." });
    }

    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) {
      return res.status(404).json({ error: "Order not found or does not belong to the user." });
    }

    // Check if any product is already shipped or delivered
    const hasShippedOrDelivered = order.orderedItems.some(
      item => item.status === "Shipped" || item.status === "Delivered"
    );

    if (hasShippedOrDelivered) {
      return res.status(400).json({ error: "Cannot cancel order. Some items have already been shipped or delivered." });
    }

    // Check if all products are already cancelled
    const allCancelled = order.orderedItems.every(item => item.status === "Cancelled");
    if (allCancelled) {
      return res.status(400).json({ error: "Order is already cancelled." });
    }

    // Update all products' status to Cancelled
    order.orderedItems.forEach(item => {
      if (item.status !== "Shipped" && item.status !== "Delivered") {
        item.status = "Cancelled";
      }
    });

    await order.save();

    return res.status(200).json({ message: "Order cancelled successfully" });
  } catch (error) {
    console.error("Error canceling order:", error);
    return res.status(500).json({ error: "Failed to cancel the order. Please try again later." });
  }
};

const returnProduct = async (req, res) => {
    try {
        const { orderId, productId, reason } = req.body;
        const userId = req.session.user;

        const order = await Order.findOne({ _id: orderId, userId });
        
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        const orderItem = order.orderedItems.find(
            item => item.id.toString() === productId
        );

        if (!orderItem) {
            return res.status(404).json({ success: false, message: "Product not found in order" });
        }

        if (orderItem.status !== "Delivered") {
            return res.status(400).json({ 
                success: false, 
                message: "Only delivered products can be returned" 
            });
        }

        // Calculate refund amount based on the final amount
        const refundAmount = parseFloat(order.finalAmount);

        // Add refund to wallet
        await walletController.useWalletBalance(
            userId, 
            refundAmount, 
            `Refund for returned product from order #${orderId}`, 
            'credit'
        );

        // Update the order status to Returned and add reason
        orderItem.status = "Returned";
        orderItem.reason = reason;
        orderItem.refundAmount = refundAmount; // Store the actual refunded amount
        await order.save();

        // Update product quantity
        await Product.findByIdAndUpdate(
            productId,
            { $inc: { quantity: orderItem.quantity } }
        );

        return res.status(200).json({ 
            success: true, 
            message: `Product returned and refund of ₹${refundAmount.toFixed(2)} initiated successfully` 
        });

    } catch (error) {
        console.error("Error in returning product:", error);
        return res.status(500).json({ 
            success: false, 
            message: "Internal server error" 
        });
    }
};

module.exports={
    getCart,
    addToCart,
    removeProduct,
    updateCartQuantity,
    cancelOrder,
    cancelEntireOrder,
    returnProduct
}