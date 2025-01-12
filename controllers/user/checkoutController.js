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

      const findProduct = cart.items.filter(item=>{
          const product = item.productId
          
          return (product.isBlocked === false && listedCategory.includes(product.category.toString()))
      });
      console.log(findProduct,"this is a find product");
      
      const subTotal = findProduct.reduce((sum, items)=> sum + items.totalPrice ,0);
      let shiipingCost =0
      
      const total = subTotal + shiipingCost;

      res.render("checkout", {
        user: userId,
        cart: findProduct ? findProduct : [],
        addresses: userAddress ? userAddress.address : [],
        subTotal,
        total,
    
    
          
      })
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
    console.log("heyyyy");
    try {
        const userId = req.session.user;

        if (!userId) {
            return res.redirect("/login");
        }

        const { address, products, subtotal, total, paymentMethod } = req.body;
        console.log(products,"this is a product details");

        if (paymentMethod !== "Cash On Delivery") {
            return res.status(400).json({ success: false, message: "Invalid payment method" });
        }

        if (!Array.isArray(products) || products.length === 0) {
            return res.status(400).json({ success: false, message: "No products provided" });
        }

        const groupedProducts = products.reduce((acc, item) => {
            acc[item.id] = acc[item.id] || { ...item, quantity: 0 };
            acc[item.id].quantity += item.quantity;
            return acc;
        }, {});
        console.log(groupedProducts,"this is a group ptoduct");

        for (let productId in groupedProducts) {
            const item = groupedProducts[productId];
            console.log(productId);
            console.log("67768c2c8fde4de658747cbb");
            // const product = await Product.findOne({_id:productId}); 
            const product = await Product.findOne({ _id: new mongoose.Types.ObjectId(productId) });

            console.log(product);

            if (!product) {
                return res.status(404).json({ success: false, message: `Product not found: ${productId}` });
            }

            if (product.quantity < item.quantity) {
                return res.status(400).json({
                    success: false,
                    message: `Not enough stock for product: ${product.name}`,
                });
            }

            product.quantity -= item.quantity;
            await product.save();
        }

        const newOrder = new Order({
            userId: userId,
            orderedItems: products,
            shippingAddress: address,
            totalPrice: subtotal,
            finalAmount: total,
            status: "pending",
            paymentMethod: paymentMethod,
            payment_status: "Pending",
        });

        await Cart.findOneAndUpdate({ userId: userId._id }, { $set: { items: [] } });

        const orderSave = await newOrder.save();
        if (orderSave) {
            const orderId = newOrder._id;
            return res.status(200).json({ success: true, message: "Order placed", orderId: orderId });
        } else {
            return res.status(400).json({ success: false, message: "Error saving order" });
        }
    } catch (error) {
        console.log("Error:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
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
