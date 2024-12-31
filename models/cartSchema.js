const mongoose=require("mongoose");
const nodemon = require("nodemon");
const {Schema}=mongoose;

const cartSchema=new Schema({
  userId:{
    type:Schema.Types.ObjectId,
    ref:"User",
    required:true
  },
  items:[{
    productId:{
      type:Schema.Types.ObjectId,
      ref:"Product",
      required:true
    },
    quantity:{
      type:Number,
      default:1
    },
    price:{
      type:Number,
      required:true
    },
    totoalPrice:{
      type:Number,
      require:true
    },
    status:{
      type:String,
      default:'placed'
    },
    cancellationReason:{
      type:String,
      default:"none"
    }
  }]
})

const Cart=mongoose.models("Cart",cartSchema);
module.exports=Cart;