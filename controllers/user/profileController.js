const User = require("../../models/userSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const env = require("dotenv").config();
const session = require("express-session");
const { getWalletDetails, getWalletHistory } = require('./walletController');
const PDFDocument = require('pdfkit');
const ejs = require('ejs');
const path = require('path');

function generateOtp() {
  const digit = "1234567890";
  let otp = "";
  for (let i = 0; i < 6; i++) {
    otp += digit[Math.floor(Math.random() * 10)];
  }
  return otp;
}

const sendVerificationEmail = async (email, otp) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      port: 587,
      secure: false,
      requireTLs: true,
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD
      }
    })

    const mailOptions = {
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Your OTP for password reset",
      text: `Your OTP is ${otp}`,
      html: `<b><h4>Your OTP: ${otp}</h4><br></b>`
    }

    const info = await transporter.sendMail(mailOptions);
    console.log("Email Send ", info.messageId);
    return true;
  } catch (error) {
    console.error("Error sending Mail", error);
    return false;
  }
}

const securePassword = async (password) => {
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    return passwordHash;
  } catch (error) {

  }
}

const getForgotPassPage = async (req, res) => {
  try {
    res.render("forgot-password")
  } catch (error) {
    res.redirect("/pageNotFound")
  }
}

const forgotEmailValid = async (req, res) => {
  try {
    const { email } = req.body;
    const findUser = await User.findOne({ email: email });
    if (findUser) {
      const otp = generateOtp();
      const emailSent = await sendVerificationEmail(email, otp);
      if (emailSent) {
        req.session.userOtp = otp;
        req.session.email = email;
        console.log('jj', req.session.email);
        res.render("forgotPass-otp");
        console.log("OTP", otp);

      } else {
        res.json({ success: false, message: "Failed to send Otp. please try again" });
      }
    } else {
      res.render("forgot-password", {
        messaage: "User with this email does not exist"
      });
    }
  } catch (error) {
    res.redirect("/pageNotFound")
  }
}

const verifyForgotPassOtp = async (req, res) => {
  try {

    const enteredOtp = req.body.otp;
    console.log("vrfy otp-", enteredOtp)
    if (enteredOtp === req.session.userOtp) {
      res.json({ success: true, redirectUrl: "/reset-password" });
    } else {
      res.json({ success: false, message: "OTP not matching" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: "An error occured. Please try again " });
  }
}

const getResetPassPage = async (req, res) => {
  try {
    res.render("reset-password");
  } catch (error) {
    res.redirect("/pageNotFound");
  }
}

const resendOtp = async (req, res) => {
  try {
    const otp = generateOtp();
    req.session.userOtp = otp;
    const email = req.session.email;
    console.log("Resending OTP to email:", email);
    const emailSend = await sendVerificationEmail(email, otp);
    if (emailSend) {
      console.log("Resend OTP:", otp);
      res.status(200).json({ success: true, message: "Resent OTP successfully" });
    }
  } catch (error) {
    console.error("Erorr is resend OTP", error);
    res.status(500).json({ success: false, message: "Internal Server Error" })
  }
}

const postNewPassword = async (req, res) => {
  try {
    const { newPass1, newPass2 } = req.body;
    const email = req.session.email;
    if (newPass1 === newPass2) {
      const passwordHash = await securePassword(newPass1);
      await User.updateOne(
        { email: email },
        { $set: { password: passwordHash } }
      )
      res.redirect('/login')
    } else {
      res.render('/reset-password', { messaage: 'Password do not match' })
    }
  } catch (error) {
    res.redirect('/pageNotFound');
  }
}

const userProfile = async (req, res) => {
  try {
    const userId = req.session.user;
    const userData = await User.findById(userId);
    const addressData = await Address.findOne({ userId: userId });

    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    // Get total orders count
    const totalOrders = await Order.countDocuments({ userId: userId });
    const totalPages = Math.ceil(totalOrders / limit);

    // Get orders with proper sorting
    const orderData = await Order.find({ userId: userId })
      .populate('orderedItems.id', 'productName productImage price')
      .sort({ createdOn: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get wallet information
    const wallet = await getWalletDetails(req, res);
    const walletHistory = await getWalletHistory(req, res);

    res.render('profile', {
      user: userData,
      userAddress: addressData,
      orderData: orderData,
      wallet: wallet,
      walletHistory: walletHistory,
      currentPage: page,
      totalPages: totalPages,
      query: req.query
    })
  } catch (error) {
    console.error("Error for retrieve profile data", error);
    res.redirect("/pageNotFound")
  }
}

const addAddress = async (req, res) => {
  try {
    const user = req.session.user;
    res.render("add-address", { user: user })
  } catch (error) {
    res.redirect("/pageNotFound")
  }
}

const postAddAddress = async (req, res) => {
  try {
    const userId = req.session.user;
    const userData = await User.findOne({ _id: userId })
    const { addressType, name, city, landMark, state, pincode, phone, altPhone } = req.body;

    const userAddress = await Address.findOne({ userId: userData._id });
    if (!userAddress) {
      const newAddress = new Address({
        userId: userData._id,
        address: [{ addressType, name, city, landMark, state, pincode, phone, altPhone }]
      })
      await newAddress.save();
    } else {
      userAddress.address.push({ addressType, name, city, landMark, state, pincode, phone, altPhone });
      await userAddress.save();
    }
    res.redirect("/userProfile")
  } catch (error) {
    console.error("Error adding address", error);
    res.redirect("/pageNotFound")
  }
}

const editAddress = async (req, res) => {
  try {
    const addressId = req.query.id;
    const user = req.session.user;
    const currAddress = await Address.findOne({
      "address._id": addressId,
    })
    if (!currAddress) {
      return res.redirect("/pageNotFound")
    }
    const addressData = currAddress.address.find((item) => {
      return item._id.toString() === addressId.toString();
    })
    if (!addressData) {
      return res.redirect('/pageNotFound');
    }
    res.render('edit-address', { address: addressData, user: user });
  } catch (error) {
    console.error("Error is edit address", error);
    res.redirect("/pageNotFound");
  }
}

const postEditAddress = async (req, res) => {
  try {
    const data = req.body;
    const addressId = req.query.id;
    const user = req.session.user;
    const findAddress = await Address.findOne({ 'address._id': addressId });
    if (!findAddress) {
      res.redirect("/pageNotFound");
    }
    await Address.updateOne(
      { "address._id": addressId },
      { $set: { "address.$": { _id: addressId, addressType: data.addressType, name: data.name, city: data.city, landMark: data.landMark, state: data.state, pincode: data.pincode, phone: data.phone, altPhone: data.altPhone, } } }
    )
    res.redirect('/userProfile')
  } catch (error) {
    console.error("Error in edit address", error);
    res.redirect("/pageNotFound")
  }
}

const deleteAddress = async (req, res) => {
  try {
    const addressId = req.query.id;
    const findAddress = await Address.findOne({ "address._id": addressId });
    if (!findAddress) {
      return res.status(400).send("Address Not Found")
    }
    await Address.updateOne({
      "address._id": addressId
    },
      { $pull: { address: { _id: addressId, } } }

    )
    res.redirect("/userProfile")
  } catch (error) {
    console.error("Error in delete address", error);
    res.redirect("/pageNotFound")
  }
}

const changePassword = async (req, res) => {
  try {
    res.render("change-password")
  } catch (error) {
    res.redirect("/pageNotFound")
  }
}
const changePasswordValid = async (req, res) => {
  try {
    const { email } = req.body;
    const userExists = await User.findOne({ email });
    if (userExists) {
      const otp = generateOtp();
      const emailSend = await sendVerificationEmail(email, otp);
      if (emailSend) {
        req.session.userOtp = otp;
        req.session.userData = req.body;
        req.session.email = email;
        res.render("change-password-otp")
        console.log("OTP", otp);
      } else {
        res.json({
          success: false,
          message: "Faield to send OTP.please try again",

        })
      }
    } else {
      res.render("change-password", {
        message: "User with this email does not exist"
      })
    }
  } catch (error) {
    console.log("Error in change password validation ", error);
    res.redirect("/pageNotFound")
  }
}

const verifyChangepassotp = async (req, res) => {
  try {
    const enteredOtp = req.body.otp;
    console.log(enteredOtp, req.session.resendOtp);
    if (enteredOtp === req.session.userOtp) {
      res.json({ success: true, redirectUrl: "/reset-password" })
    } else {
      res.json({ success: false, message: "OTP not matching" })
    }
  } catch (error) {
    res.status(500).json({ success: false, message: "An error occured.Please try again later" })
  }
}

const getOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      console.error('Invalid order ID format');
      return res.redirect('/userProfile');
    }

    const order = await Order.findById(orderId).populate({
      path: 'orderedItems.id',
      model: 'Product',
      select: 'productName productImage'
    });

    if (!order) {
      console.error('Order not found:', orderId);
      return res.redirect('/userProfile');
    }

    // Add payment status if not present
    if (!order.payment_status) {
      order.payment_status = order.orderedItems[0].status === 'pending' ? 'pending' : 'completed';
      await order.save();
    }

    // Add payment method if not present
    if (!order.paymentMethod) {
      order.paymentMethod = 'cod'; // default to COD if not specified
      await order.save();
    }

    res.render("orderDetails", { 
      order,
      user: req.session.user 
    });
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.redirect('/userProfile');
  }
};

const downloadInvoice = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const order = await Order.findById(orderId)
      .populate('orderedItems.id');

    if (!order) {
      return res.status(404).send('Order not found');
    }

    // Create PDF document
    const doc = new PDFDocument({margin: 50});

    // Set response headers
    res.contentType('application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.orderId}.pdf`);

    // Pipe the PDF to the response
    doc.pipe(res);

    // Add content to the PDF
    // Header
    doc.fontSize(20).text('SIXIT', {align: 'center'});
    doc.moveDown();
    doc.fontSize(12).text('Invoice', {align: 'center'});
    doc.moveDown();

    // Format date
    const orderDate = new Date(order.createdOn);
    const formattedDate = orderDate.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });

    // Order Information
    doc.fontSize(10)
       .text(`Order ID: ${order.orderId}`)
       .text(`Date: ${formattedDate}`)
       .text(`Status: ${order.status || 'Processing'}`);
    
    doc.moveDown();

    // Shipping Address
    doc.fontSize(12).text('Shipping Address:', {underline: true});
    doc.fontSize(10)
       .text(order.shippingAddress.name)
       .text(order.shippingAddress.addressType)
       .text(order.shippingAddress.landmark)
       .text(`${order.shippingAddress.city}, ${order.shippingAddress.state}`)
       .text(`PIN: ${order.shippingAddress.pincode}`)
       .text(`Phone: ${order.shippingAddress.phone}`);

    doc.moveDown();

    // Items Table
    doc.fontSize(12).text('Order Items:', {underline: true});
    doc.moveDown();

    // Table headers
    let y = doc.y;
    doc.fontSize(10)
       .text('Item', 50, y)
       .text('Quantity', 250, y)
       .text('Price', 350, y)
       .text('Total', 450, y);

    doc.moveDown();
    y = doc.y;

    // Draw a line
    doc.moveTo(50, y).lineTo(550, y).stroke();
    doc.moveDown();

    // Table rows
    order.orderedItems.forEach(item => {
        y = doc.y;
        const itemPrice = parseFloat(item.price);
        const itemTotal = itemPrice * item.quantity;
        
        doc.fontSize(10)
           .text(item.name, 50, y)
           .text(item.quantity.toString(), 250, y)
           .text(`₹${itemPrice.toFixed(2)}`, 350, y)
           .text(`₹${itemTotal.toFixed(2)}`, 450, y);
        doc.moveDown();
    });

    // Draw a line
    y = doc.y;
    doc.moveTo(50, y).lineTo(550, y).stroke();
    doc.moveDown();

    // Calculate totals
    const subtotal = order.totalPrice;
    const discount = order.discount || 0;
    const finalAmount = parseFloat(order.finalAmount);

    // Total section
    doc.fontSize(12)
       .text(`Subtotal: ₹${subtotal.toFixed(2)}`, {align: 'right'});
    
    if (discount > 0) {
        doc.text(`Discount: ₹${discount.toFixed(2)}`, {align: 'right'});
    }
    
    doc.text(`Final Amount: ₹${finalAmount.toFixed(2)}`, {align: 'right'});

    // Footer
    doc.fontSize(10)
       .text('Thank you for shopping with SIXIT!', 50, doc.page.height - 100, {
           align: 'center',
           width: doc.page.width - 100
       });

    // Finalize the PDF
    doc.end();

  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).send('Error generating invoice');
  }
};

const getProfilePage = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.redirect('/login');
        }

        const userId = req.session.user;
        
        // Get user data
        const user = await User.findById(userId);
        if (!user) {
            return res.redirect('/login');
        }

        // Get address data
        const userAddress = await Address.findOne({ userId: userId });

        // Pagination parameters
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        // Get total orders count
        const totalOrders = await Order.countDocuments({ userId: userId });
        const totalPages = Math.ceil(totalOrders / limit);

        // Get orders with pagination and sorting
        const orderData = await Order.find({ userId: userId })
            .populate('orderedItems.id', 'productName productImage price')
            .sort({ createdOn: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        // Get wallet information
        const wallet = await getWalletDetails(req, res);
        const walletHistory = await getWalletHistory(req, res);

        res.render('user/profile', {
            user,
            userAddress,
            orderData,
            wallet,
            walletHistory,
            currentPage: page,
            totalPages: totalPages,
            query: req.query
        });
    } catch (error) {
        console.error('Error loading profile page:', error);
        res.status(500).send('Error loading profile page');
    }
};

const getEditProfilePage = async (req, res) => {
    try {
        const user = await User.findById(req.session.user._id);
        res.render('user/editProfile', { user });
    } catch (error) {
        console.error('Error loading edit profile page:', error);
        res.status(500).send('Error loading edit profile page');
    }
};

const editProfile = async (req, res) => {
    try {
        const { name, email, phone } = req.body;
        await User.findByIdAndUpdate(req.session.user._id, { name, email, phone });
        res.redirect('/profile');
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).send('Error updating profile');
    }
};

const getAddressPage = async (req, res) => {
    try {
        const addresses = await Address.find({ user: req.session.user._id });
        res.render('user/address', { addresses });
    } catch (error) {
        console.error('Error loading address page:', error);
        res.status(500).send('Error loading address page');
    }
};

const getEditAddressPage = async (req, res) => {
    try {
        const address = await Address.findById(req.query.id);
        res.render('user/editAddress', { address });
    } catch (error) {
        console.error('Error loading edit address page:', error);
        res.status(500).send('Error loading edit address page');
    }
};

const getOrdersPage = async (req, res) => {
  try {
    const userId = req.session.user;
    const page = parseInt(req.query.page) || 1;
    const itemsPerPage = 5;

    // Get orders with pagination, sorted by latest first
    const orderData = await Order.find({ userId: userId })
      .populate('orderedItems.id', 'productName productImage price')
      .sort({ createdOn: -1, _id: -1 }) // Sort by createdOn first, then by _id for same timestamps
      .lean();

    // Add formatted date to each order
    orderData.forEach(order => {
      order.formattedDate = new Date(order.createdOn).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    });

    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const totalPages = Math.ceil(orderData.length / itemsPerPage);
    const paginatedOrders = orderData.slice(startIndex, endIndex);

    res.json({
      orders: paginatedOrders,
      currentPage: page,
      totalPages: totalPages
    });
  } catch (error) {
    console.error("Error retrieving orders:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const getOrdersData = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const userId = req.session.user;
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        // Get total orders count
        const totalOrders = await Order.countDocuments({ userId: userId });
        const totalPages = Math.ceil(totalOrders / limit);

        // Get orders with pagination and sorting
        const orderData = await Order.find({ userId: userId })
            .populate('orderedItems.id', 'productName productImage price')
            .sort({ createdOn: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        res.json({
            orders: orderData,
            currentPage: page,
            totalPages: totalPages
        });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ error: 'Error fetching orders' });
    }
};

module.exports = {
    getForgotPassPage,
    forgotEmailValid,
    verifyForgotPassOtp,
    getResetPassPage,
    resendOtp,
    postNewPassword,
    userProfile,
    addAddress,
    postAddAddress,
    editAddress,
    postEditAddress,
    deleteAddress,
    changePassword,
    changePasswordValid,
    verifyChangepassotp,
    getProfilePage,
    getOrdersData,
    getEditProfilePage,
    editProfile,
    getAddressPage,
    getEditAddressPage,
    getOrdersPage,
    getOrderDetails,
    downloadInvoice
}