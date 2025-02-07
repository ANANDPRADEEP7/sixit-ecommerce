const User = require('../../models/userSchema');
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const Brand = require('../../models/brandSchema');

const pageerror = async (req, res) => {
  try {
    res.render('admin/pageerror');
  } catch (error) {
    console.error('Error in pageerror:', error);
    res.status(500).send('Internal Server Error');
  }
}

const loadLogin = async (req, res) => {
  try {
    if (req.isAuthenticated() && req.user.role === 'admin') {
      res.redirect('/admin');
    } else {
      res.render('admin/adminlogin');
    }
  } catch (error) {
    console.error('Error in loadLogin:', error);
    res.status(500).send('Internal Server Error');
  }
}

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await User.findOne({ email, isAdmin: true });

    if (!admin) {
      return res.json({ success: false, message: 'Invalid credentials' });
    }

    const passwordMatch = await bcrypt.compare(password, admin.password);

    if (passwordMatch) {
      req.session.admin = admin;
      return res.json({ success: true, message: 'Login successful' });
    }

    return res.json({ success: false, message: 'Invalid credentials' });

  } catch (error) {
    console.error("Login error:", error);
    return res.json({ success: false, message: 'An error occurred' });
  }
};

const getTopProducts = async () => {
  try {
 
    const topProducts = await Order.aggregate([
      { $unwind: '$orderedItems' },
      {
        $group: {
          _id: '$orderedItems.id',
          totalQuantity: { $sum: '$orderedItems.quantity' },
          totalRevenue: { 
            $sum: { 
              $multiply: [
                '$orderedItems.quantity',
                { $toDouble: '$orderedItems.price' }
              ] 
            } 
          }
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $project: {
          name: '$product.productName',
          quantity: '$totalQuantity',
          revenue: '$totalRevenue'
        }
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 }
    ]);

  
    return topProducts;
  } catch (error) {
    console.error('Error in getTopProducts:', error);
    return [];
  }
};

const getTopCategories = async () => {
  try {
  
    const topCategories = await Order.aggregate([
      { $unwind: '$orderedItems' },
      {
        $lookup: {
          from: 'products',
          localField: 'orderedItems.id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $group: {
          _id: '$product.category',
          totalQuantity: { $sum: '$orderedItems.quantity' },
          totalRevenue: { 
            $sum: { 
              $multiply: [
                '$orderedItems.quantity',
                { $toDouble: '$orderedItems.price' }
              ] 
            } 
          }
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'category'
        }
      },
      { $unwind: '$category' },
      {
        $project: {
          name: '$category.name',
          quantity: '$totalQuantity',
          revenue: '$totalRevenue'
        }
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 }
    ]);

    return topCategories;
  } catch (error) {
    console.error('Error in getTopCategories:', error);
    return [];
  }
};

const getTopBrands = async () => {
  try {
   
    const topBrands = await Order.aggregate([
      { $unwind: '$orderedItems' },
      {
        $lookup: {
          from: 'products',
          localField: 'orderedItems.id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $group: {
          _id: '$product.brand',
          totalQuantity: { $sum: '$orderedItems.quantity' },
          totalRevenue: { 
            $sum: { 
              $multiply: [
                '$orderedItems.quantity',
                { $toDouble: '$orderedItems.price' }
              ] 
            } 
          }
        }
      },
      {
        $project: {
          name: '$_id',
          quantity: '$totalQuantity',
          revenue: '$totalRevenue'
        }
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 }
    ]);

    return topBrands;
  } catch (error) {
    console.error('Error in getTopBrands:', error);
    return [];
  }
};

const loadDashboard = async (req, res) => {
  try {
    // Get total revenue from all orders
    const totalRevenue = await Order.aggregate([
      {
        $unwind: "$orderedItems"
      },
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $multiply: [
                { $toDouble: "$orderedItems.price" },
                "$orderedItems.quantity"
              ]
            }
          }
        }
      }
    ]);

    const revenueValue = totalRevenue[0]?.total || 0;
  

    // Check if we have any orders at all
    const allOrders = await Order.find({
      $or: [
        { payment_status: "Completed" },
        { payment_status: "Paid" },
        { paymentMethod: "Cash On Delivery", status: "Delivered" }
      ]
    }).lean();


    // Get total orders count
    const totalOrders = await Order.countDocuments();

    // Get total products count
    const totalProducts = await Product.countDocuments();

    // Get total categories count
    const totalCategories = await Category.countDocuments();

    // Get monthly earnings (current month)
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const monthlyEarning = await Order.aggregate([
      { $unwind: '$orderedItems' },
      {
        $match: {
          'orderedItems.status': 'Delivered',
          createdOn: { $gte: startOfMonth }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $toDouble: '$orderedItems.finalAmount' } }
        }
      }
    ]);

    // Get recent orders
    const recentOrders = await Order.find()
      .sort({ createdOn: -1 })
      .limit(7)
      .populate('userId', 'name')
      .lean();

    // Get recent users
    const recentUsers = await User.find({ isAdmin: false })
      .sort({ createdOn: -1 })
      .limit(3)
      .select('name email')
      .lean();

    // Get recent activities
    const recentActivities = await Promise.all([
      Order.find()
        .sort({ createdOn: -1 })
        .limit(5)
        .populate('userId', 'name')
        .lean(),
      User.find({ isAdmin: false })
        .sort({ createdOn: -1 })
        .limit(5)
        .lean()
    ]);

    // Format activities
    const activities = [...recentActivities[0], ...recentActivities[1]]
      .sort((a, b) => b.createdOn - a.createdOn)
      .slice(0, 5)
      .map(activity => ({
        date: activity.createdOn,
        text: activity.userId ? 
          `New order placed by ${activity.userId.name}` : 
          `New user registered: ${activity.name}`
      }));

    // Get top performers
    const [topProducts, topCategories, topBrands] = await Promise.all([
      getTopProducts(),
      getTopCategories(),
      getTopBrands()
    ]);

  

    res.render('admin/dashboard', {
      totalRevenue: revenueValue,
      totalOrders,
      totalProducts,
      totalCategories,
      monthlyEarning: monthlyEarning[0]?.total || 0,
      recentOrders,
      recentUsers,
      activities,
      salesData: await getSalesData('monthly'),
      marketingData: {
        facebook: 15,
        instagram: 65,
        google: 51,
        twitter: 80,
        other: 30
      },
      areaRevenue: {
        labels: ['North', 'South', 'East', 'West'],
        data: [30, 25, 25, 20]
      },
      topProducts: topProducts || [],
      topCategories: topCategories || [],
      topBrands: topBrands || []
    });

  } catch (error) {
    console.error('Error in loadDashboard:', error);
    res.redirect('/admin/pageerror');
  }
};

const getSalesData = async (period) => {
  try {
    const now = new Date();
    let groupBy, startDate, dateFormat;
    
    switch (period) {
      case 'daily':
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0); // Start from beginning of today
        groupBy = {
          year: { $year: '$createdOn' },
          month: { $month: '$createdOn' },
          day: { $dayOfMonth: '$createdOn' },
          hour: { $hour: '$createdOn' }
        };
        dateFormat = '%Y-%m-%d %H:00';
        break;
      case 'weekly':
        // Last 7 days
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 6);
        groupBy = {
          year: { $year: '$createdOn' },
          month: { $month: '$createdOn' },
          day: { $dayOfMonth: '$createdOn' }
        };
        dateFormat = '%Y-%m-%d';
        break;
      case 'monthly':
        // Last 30 days
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 29);
        groupBy = {
          year: { $year: '$createdOn' },
          month: { $month: '$createdOn' },
          day: { $dayOfMonth: '$createdOn' }
        };
        dateFormat = '%Y-%m-%d';
        break;
      case 'yearly':
        // Last 12 months
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 11);
        groupBy = {
          year: { $year: '$createdOn' },
          month: { $month: '$createdOn' }
        };
        dateFormat = '%Y-%m';
        break;
    }

    const result = await Order.aggregate([
      {
        $match: {
          createdOn: { $gte: startDate }
        }
      },
      { $unwind: '$orderedItems' },
      {
        $group: {
          _id: groupBy,
          totalSales: {
            $sum: {
              $multiply: [
                '$orderedItems.quantity',
                { $toDouble: '$orderedItems.price' }
              ]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          date: {
            $dateToString: {
              format: dateFormat,
              date: {
                $dateFromParts: {
                  year: '$_id.year',
                  month: '$_id.month',
                  day: { $ifNull: ['$_id.day', 1] },
                  hour: { $ifNull: ['$_id.hour', 0] }
                }
              }
            }
          },
          totalSales: 1
        }
      },
      { $sort: { date: 1 } }
    ]);

    // Fill in missing dates/hours with zero sales
    const filledData = [];
    const endDate = new Date(now);
    
    if (period === 'daily') {
      // For daily view, fill in all 24 hours
      for (let hour = 0; hour < 24; hour++) {
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(hour).padStart(2, '0')}:00`;
        const existingData = result.find(item => item.date === dateStr);
        filledData.push({
          date: dateStr,
          totalSales: existingData ? existingData.totalSales : 0
        });
      }
    } else {
      // For other periods, fill in missing dates
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        let dateStr;
        if (period === 'yearly') {
          dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        } else {
          dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }
        const existingData = result.find(item => item.date === dateStr);
        filledData.push({
          date: dateStr,
          totalSales: existingData ? existingData.totalSales : 0
        });
      }
    }

    return filledData;
  } catch (error) {
    console.error('Error in getSalesData:', error);
    return [];
  }
};

const logout = async (req, res) => {
  try {
    req.session.destroy(err => {
      if (err) {
      

        return res.redirect("/pageerror")
      }
      res.redirect("/admin/login")
    })
  } catch (error) {
   
    res.redirect("pageerror")
  }
}

module.exports = {
  loadLogin,
  login,
  loadDashboard,
  logout,
  getSalesData,
  pageerror
}