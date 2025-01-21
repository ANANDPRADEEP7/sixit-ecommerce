const Order = require("../../models/orderSchema")
const Address = require("../../models/addressSchema")


const orderList=async (req,res)=>{
  try {
    const order = await Order.find()
      .populate("userId", "name email")
      .populate("orderedItems.id", "productName productImage")
      .sort({ 
        createdAt: -1,  // Sort by creation date descending
        _id: -1         // Then by _id descending for consistent ordering
      })
      .exec();

    // Log the order dates to verify sorting
    console.log("Order dates:", order.map(o => ({
      id: o._id,
      date: o.createdAt,
      status: o.status
    })));

    res.render("orderList",{order})
  } catch (error) {
    console.error("error in load order page",error);   
    res.redirect("/pageNotFound")
  }
}



const orderView = async (req, res) => {
  try {
      const orderId = req.params.orderId;
      const order = await Order.findById(orderId)
          .populate("userId", "name email")
          .populate("orderedItems.id", "productName productImage")
          .exec();

      res.render("order-view", { order});
  } catch (error) {
      console.error("Error fetching order details:", error);
      res.redirect("/pageNotFound");
  }
};


const EditStatusPage = async(req,res)=>{
  try {
      const orderId = req.params.orderId
      const order = await Order.findById(orderId)
      .populate("userId","name email")
      .populate("orderedItems.id","productName productImage")
      .exec()
     
      
      res.render("order-statusEdit",{order})
  } catch (error) {
      console.error("Error in update order status",error);
      res.redirect("/pageNotFound") 
  }
}

const EditStatus = async (req, res) => {
  try {
    
    const orderStatuses = {
      pending: ["Processing", "Cancelled"],
      Processing: ["Shipped", "Cancelled"],
      Shipped: ["Delivered"],
      Delivered: [],
      Cancelled: []
    };

    const { orderId, status, itemIndex } = req.body;
    
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).send("Order not found");
    }

    
    const orderedItem = order.orderedItems[itemIndex];
    if (!orderedItem) {
      return res.status(404).send("Ordered item not found");
    }

    
    const currentStatus = orderedItem.status;
    const allowedStatuses = orderStatuses[currentStatus];

    if (!allowedStatuses || !allowedStatuses.includes(status)) {
      return res.status(400).send(`Cannot change status from ${currentStatus} to ${status}`);
    }

   
    order.orderedItems[itemIndex].status = status;

   

    await order.save();

    res.redirect("/admin/orderList");
  } catch (error) {
    console.error("Error in updating order status:", error);
    res.status(500).redirect("/admin/pageerror");
  }
};


module.exports={
  orderList,
  orderView,
  EditStatusPage,
  EditStatus
}