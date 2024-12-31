const mongoose=require("mongoose");
const {Schema}=mongoose;
const {v4:uuidv4}=require("uuid");

const orderSchema=new Schema({
  orderId:{
    type:String,
    default:()=>uuidv4(),
    unique:true
  },
  orderedItem:[{
    product:{
      type:Schema.Types.ObjectId,
      ref:"Product",
      required:true
    },
    quantity:{
      type:Number,
      required:true
    },
    price:{
      type:Number,
      default:0
    }
  }],
  totalPrice:{
    type:Number,
    required:true
  },
  discount:{
    type:Number,
    default:true
  },
  finalAmount:{
    type:Number,
    required:true
  },
  address:{
    type:Schema.Types.ObjectId,
    ref:"User",
    required:true
  },
  invoiceDate:{
    type:Date
  },
  status:{
    type:String,
    required:true,
    enum:["Pending","Processing","shipped","Delivered","Cancelled","Return Request","Returnrd"]
  },
  createOne:{
    type:Date,
    default:Date.now,
    required:true
  },
  couponApplied:{
    type:Boolean,
    default:false
  }
})

const Order=monggse.model("Order",orderSchema);
module.exports=Order;