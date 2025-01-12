const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");
const Category=require('../../models/categorySchema');
const Order=require("../../models/orderSchema")
const { productDetails } = require("./productController");
const mongoose = require("mongoose");



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

// const addToCart = async (req, res) => {
//   try {
//       const productId = req.body.productId;
//       console.log('asdfghjkl;',productId);
//       const userId = req.session.user;
//       const cartLimit = 5;

//       let cart = await Cart.findOne({ userId });
//       if (!cart) {
//           cart = new Cart({ userId, items: [] });
//       }

//       const product = await Product.findById(productId)
//       console.log("product",product);
//       if(!product){
//           return res.status(404).json({status:false, message:"product not found"})
//       }
    

//       if(product.quantity <= 0){
//           return res.status(400).json({status:false, message:"Product is out of stock..!"})
//       }
      
//       const productInCart = cart.items.find((item) => item.productId.toString() === productId);
//       console.log("pro cart",productInCart);

      

//       const updatedPrice = product.salePrice * p;
//       console.log("updated price-",updatedPrice)

//       if (productInCart) {
//          if(productInCart.quantity >= cartLimit){
//           return res.status(200).json({status:false, message:"Maximum quantity add this product to cart is reached...!"})
//          }

//          productInCart.quantity +=1;
//          productInCart.totalPrice = productInCart.price * productInCart.quantity;
        
//       }else{
         
//           cart.items.push({
//               productId,
//               price:product.salePrice,
//               totalPrice:updatedPrice,
//               quantity:1
//           })

//           // product.quantity -=1;
//       }

//       // await product.save();
//       await cart.save();
//       console.log("Product added to cart successfully");
//       return res.status(200).json({ status: true, message: "Product added to Cart Successfully." });
//   } catch (error) {
//       console.error("Error in add to cart", error);
//       return res.status(500).json({ status: false, message: "Server Error!" });
//   }
// };

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
  
      if (product.quantity <= 0) {
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
        if (product.quantity < qtyToAdd) {
          return res.status(400).json({ status: false, message: "Not enough stock to add more of this product." });
        }
  
        productInCart.quantity += qtyToAdd;
        productInCart.totalPrice = productInCart.price * productInCart.quantity;
        
        if(productInCart.quantity>3){
            return res.status(400).json({ status: false, message: "Product is out of stock!" });
        }
       
      } else {
        // Add new product to the cart
        if (product.quantity < 1) {
          return res.status(400).json({ status: false, message: "Not enough stock to add this product to the cart." });
        }
  
        cart.items.push({
          productId,
          price: product.salePrice || product.price,
          totalPrice: product.salePrice || product.price, // Initial totalPrice is the same as price
          quantity: 1,
        });
  
  
      }
  
      // Save the updates
      await product.save();
      await cart.save();
  
      return res.status(200).json({ status: true, message: "Product added to Cart Successfully." });
    } catch (error) {
      console.error("Error in addToCart:", error);
      return res.status(500).json({ status: false, message: "Server Error!" });
    }
  };
  

const removeProduct = async (req, res) => {
  try {
      const productId = req.query.productId;
      const userId = req.session.user;

    //   console.log("productId:", productId);
    //     console.log("userId:", userId);

      const cart = await Cart.findOne({ userId });
    //   console.log("cartttttttttttttttttt:", cart);

      if (!cart) {
          return res.redirect("/cart");
      }

      const findProduct = cart.items.find((item)=> item.productId.toString() === productId)
    //   console.log("findProductss", findProduct);
    //   console.log("cart.itemssss:", cart.items);


      

      const removeQty = findProduct.quantity;

      cart.items = cart.items.filter((item) => item.productId.toString() !== productId);

    //   console.log("Updated cart items:", cart.items);
      await cart.save();
      


      await Product.findByIdAndUpdate(productId,{$inc:{quantity:removeQty}}) 
    //   console.log("Updating product quantity:", productId, removeQty);
   

      return res.redirect("/getCart");
  } catch (error) {
      console.error("Error in removing item from cart", error);
      return res.status(500).json({ status: false, message: "Server Error!" });
  }
};

const updateCartQuantity = async(req,res)=>{
  try {
      const {productId, quantity} = req.body;
      console.log("quantity-",quantity);
      
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

      console.log("product--",product)

      const findProduct = cart.items.find((item)=> item.productId.toString() === productId);
      if(!findProduct){
          return res.status(404).json({status:false, message:"Product not found in the cart..!"})
      }


      console.log("find item:",findProduct)

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

    console.log("Order ID:", orderId);
    console.log("Product ID:", productId);
    console.log("User ID from session:", userId);

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: "Invalid orderId." });
    }

    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) {
      return res.status(404).json({ error: "Order not found or does not belong to the user." });
    }

    // Find the specific product in the order
    const productIndex = order.orderedItems.findIndex(item => item.name === productId);
    if (productIndex === -1) {
      return res.status(404).json({ error: "Product not found in this order." });
    }

    // Check product status
    if (order.orderedItems[productIndex].status === "Shipped") {
      return res.status(400).json({ error: "Product has already been shipped and cannot be canceled." });
    }
    if (order.orderedItems[productIndex].status === "Cancelled") {
      return res.status(400).json({ error: "Product is already canceled." });
    }

    // Update only the specific product's status
    order.orderedItems[productIndex].status = "Cancelled";
    await order.save();

    // Send JSON response
    return res.status(200).json({ message: "Product cancelled successfully" });
  } catch (error) {
    console.error("Error canceling product:", error);
    return res.status(500).json({ error: "Failed to cancel the product. Please try again later." });
  }
};



module.exports={
  getCart,
  addToCart,
  removeProduct,
  updateCartQuantity,
  cancelOrder
}       