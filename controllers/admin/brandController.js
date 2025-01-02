const Brand = require("../../models/brandSchema")
const Product=require("../../models/productSchema");


const getBrandpage =async (req,res)=>{
  try {
    const page=parseInt(req.query.page)||1;
    let message = "";
    if(req.query.msg){
      message = req.query.msg
    }
    const limit=4;
    const skip=(page-1)*limit;
    const brandData=await Brand.find({}).sort({craeteAt:-1}).skip(skip).limit(limit);
    const toatalBrands=await Brand.countDocuments();
    const totalPages=Math.ceil(toatalBrands/limit);
    const reverseBrand=brandData.reverse();
    res.render("brands",{
      data:reverseBrand,
      currentPage:page,
      totalPages:totalPages,
      totalBrands:toatalBrands,
      message
    })
  } catch (error) {
    res.redirect("/pageerror")
  }
}


const addBrand=async (req,res)=>{
  try {
    const brand =req.body.name;
    const findBrand=await Brand.findOne({brandName:{$regex:brand,$options:"i"}});
    if(!findBrand){
      const image =req.file.filename;
      const newBrand=new Brand({
        brandName:brand,
        brandImage:image,
      })
      await newBrand.save();
      return res.redirect("/admin/brandS");
    }
    const message = "Brand already exists"
    res.redirect(`/admin/brands?msg=${message}`)
  } catch (error) {
    console.error(error)
    res.redirect("/pageerror")
  }
}

const blockBrand=async (req,res)=>{
  try {
    const id=req.query.id;
    await Brand.updateOne({_id:id},{$set:{isBlocked:true}});
    res.redirect("/admin/brands")
  } catch (error) {
    res.redirect("/pageerror")
  }
}

const unBlockBrand=async (req,res)=>{
  try {
    const id=req.query.id;
    await Brand.updateOne({_id:id},{$set:{isBlocked:false}});
    res.redirect("/admin/brands")
  } catch (error) {
    res.redirect("/pageerror")
  }
}

const deleteBrand=async (req,res)=>{
  try {
    const {id}=req.query;
    if(!id){
      return res.status(400).redirect("/pageerror")
    }
    await Brand.deleteOne({_id:id});
    res.redirect("/admin/brands")
  } catch (error) {
    console.error("Error deleting brand:",error);
    res.status(500).redirect("/pageerror")
  }
}

module.exports={
  getBrandpage,
  addBrand,
  blockBrand,
  unBlockBrand,
  deleteBrand
}