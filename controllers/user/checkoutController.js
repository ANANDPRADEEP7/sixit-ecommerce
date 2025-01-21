const User =require("../../models/userSchema")
const Cart = require("../../models/cartSchema");
const Category = require("../../models/categorySchema");
const Address = require("../../models/addressSchema");
const Order = require('../../models/orderSchema');
const Product = require("../../models/productSchema");
const mongoose = require('mongoose');


const checkOutPage = async(req,res)=>{
  try {
      const userId = req.session.user;
      const cart = await Cart.findOne({userId}).populate("items.productId")
      const userAddress = await Address.findOne({userId});
      const categories = await Category.find({isListed:true})
      
      const listedCategory = categories.map(category=> category._id.toString())

      const cartItems = cart.items.filter(item=>{
          const product = item.productId
          return (product.isBlocked === false && listedCategory.includes(product.category.toString()))
      });
      
      const subTotal = cartItems.reduce((sum, items)=> sum + items.totalPrice ,0);
      let shippingCost = 0;
      let discount = 0;
      
      const total = subTotal + shippingCost;

      res.render("checkout", {
        user: userId,
        cart: cartItems,
        addresses: userAddress ? userAddress.address : [],
        subTotal,
        total,
        shippingCost,
        discount
      });
  } catch (error) {
      console.error("Error in showing checkout page",error);
      res.redirect("/pageNotFound")
  }
}


const checkOutAddress = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findOne({ _id: userId });
        
        if (!userData) {
            return res.status(400).json({
                success: false,
                message: "User not found"
            });
        }

        const { name, phone, addressType, city, state, landMark, pincode, altPhone } = req.body;

        // Validate required fields
        if (!name || !phone || !addressType || !city || !state || !pincode) {
            return res.status(400).json({
                success: false,
                message: "All required fields must be filled"
            });
        }

        // Find or create address document
        let userAddress = await Address.findOne({ userId: userData._id });
        
        const newAddressData = {
            addressType,
            name,
            city,
            landMark,
            state,
            pincode,
            phone,
            altPhone
        };

        if (!userAddress) {
            // Create new address document
            userAddress = new Address({
                userId: userData._id,
                address: [newAddressData]
            });
        } else {
            // Add to existing addresses
            userAddress.address.push(newAddressData);
        }

        await userAddress.save();

        return res.status(200).json({
            success: true,
            message: "Address added successfully"
        });

    } catch (error) {
        console.error("Add address error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
};

  const postCheckout = async (req, res) => {
    try {
        const userId = req.session.user;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Please login to continue" });
        }

        const { address, products, subtotal, total, paymentMethod } = req.body;

        if (!Array.isArray(products) || products.length === 0) {
            return res.status(400).json({ success: false, message: "No products in cart" });
        }

        if (!address || !address.id) {
            return res.status(400).json({ success: false, message: "Shipping address not selected" });
        }

        // Validate and update product quantities
        for (const item of products) {
            const product = await Product.findById(item.id);
            if (!product) {
                return res.status(404).json({ 
                    success: false, 
                    message: `Product not found: ${item.name}` 
                });
            }

            if (product.quantity < item.quantity) {
                return res.status(400).json({
                    success: false,
                    message: `Not enough stock for product: ${item.name}`,
                });
            }

            // Update product quantity
            product.quantity -= item.quantity;
            await product.save();
        }

        // Create order with required fields matching schema
        const newOrder = new Order({
            userId,
            orderedItems: products.map(item => ({
                id: item.id,
                name: item.name,
                quantity: item.quantity,
                price: item.price.toString(), // Convert to string as per schema
                status: "pending"
            })),
            shippingAddress: address,
            totalPrice: subtotal,
            finalAmount: total,
            status: "Pending",
            paymentMethod,
            payment_status: "Pending"
        });

        const savedOrder = await newOrder.save();

        if (!savedOrder) {
            return res.status(500).json({ 
                success: false, 
                message: "Failed to create order" 
            });
        }

        // Clear cart after successful order
        await Cart.findOneAndUpdate(
            { userId },
            { $set: { items: [] } }
        );

        return res.status(200).json({
            success: true,
            message: "Order placed successfully",
            orderId: savedOrder._id
        });

    } catch (error) {
        console.error("Checkout error:", error);
        return res.status(500).json({ 
            success: false, 
            message: "Internal server error",
            error: error.message 
        });
    }
};



   const orderComform = async(req,res)=>{
    const orderId = req.query.id;
    const msg = req.query.msg;
    try {
        if(!req.session.user){
            return res.redirect("/signup");
        };
        if("repayment"==msg){
            const order = await Order.findOne({orderId:orderId})
            return  res.render("orderComform",{totalPrice:order.finalAmount,date:order.createdOn.toLocaleDateString()});
        }
       const order = await Order.findOne({_id:orderId})
      return  res.render("orderComform",{totalPrice:order.finalAmount,date:order.createdOn.toLocaleDateString()});
        
    } catch (error) {
        console.log("error in onform page ",error.message);
        return res.redirect("/pageNotFound")
    }
};
  


module.exports={
  checkOutPage,
  checkOutAddress,
  orderComform,
  postCheckout
}
