const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

const getSalesReport = async (req, res) => {
    try {
        // Get default date range (current month)
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);

        // Fetch all orders with complete details
        const orders = await Order.find({})
            .populate({
                path: 'userId',
                select: 'name email phone' // Include customer details
            })
            .populate({
                path: 'orderedItems.id',
                populate: [{
                    path: 'category',
                    select: 'name categoryOffer'
                }, {
                    path: 'brand',
                    select: 'name'
                }],
                select: 'name price productOffer images brand category'
            })
            .sort({ createdOn: -1 }); // Sort by newest first

        // Filter orders within date range
        const filteredOrders = orders.filter(order => {
            const orderDate = new Date(order.createdOn);
            return orderDate >= startOfMonth && orderDate <= endOfMonth;
        });

        // Calculate summary statistics
        const summary = {
            totalOrders: filteredOrders.length,
            totalAmount: filteredOrders.reduce((sum, order) => sum + Number(order.totalPrice), 0),
            totalDiscount: filteredOrders.reduce((sum, order) => sum + Number(order.discount || 0), 0),
            averageOrderValue: 0,
            productOfferDiscount: 0,
            categoryOfferDiscount: 0,
            couponDiscount: 0,
            deliveredOrders: 0,
            pendingOrders: 0,
            cancelledOrders: 0,
            returnedOrders: 0
        };

        // Calculate detailed statistics
        filteredOrders.forEach(order => {
            // Track order statuses
            order.orderedItems.forEach(item => {
                switch(item.status) {
                    case 'Delivered':
                        summary.deliveredOrders++;
                        break;
                    case 'pending':
                    case 'Processing':
                    case 'Shipped':
                        summary.pendingOrders++;
                        break;
                    case 'Cancelled':
                        summary.cancelledOrders++;
                        break;
                    case 'Returned':
                        summary.returnedOrders++;
                        break;
                }

                // Calculate offer discounts
                const product = item.id;
                if (product && item.status !== 'Cancelled' && item.status !== 'Returned') {
                    const itemPrice = Number(item.price);
                    const quantity = Number(item.quantity);

                    // Product offer discount
                    if (product.productOffer) {
                        const discount = (itemPrice * (product.productOffer / 100)) * quantity;
                        summary.productOfferDiscount += discount;
                    }

                    // Category offer discount
                    if (product.category?.categoryOffer) {
                        const discount = (itemPrice * (product.category.categoryOffer / 100)) * quantity;
                        summary.categoryOfferDiscount += discount;
                    }
                }
            });

            // Track coupon discounts
            if (order.couponApplied) {
                summary.couponDiscount += Number(order.discount || 0);
            }
        });

        summary.averageOrderValue = summary.totalOrders > 0 ? summary.totalAmount / summary.totalOrders : 0;

        // Calculate payment statistics
        const paymentStats = filteredOrders.reduce((stats, order) => {
            const method = order.paymentMethod?.toLowerCase() || 'other';
            if (!stats[method]) {
                stats[method] = { count: 0, amount: 0 };
            }
            stats[method].count++;
            stats[method].amount += Number(order.totalPrice);
            return stats;
        }, {});

        // Calculate daily sales trend
        const dailyStats = [];
        let currentDate = new Date(startOfMonth);
        while (currentDate <= endOfMonth) {
            const dayStart = new Date(currentDate);
            const dayEnd = new Date(currentDate);
            dayEnd.setHours(23, 59, 59);

            const dayOrders = filteredOrders.filter(order => {
                const orderDate = new Date(order.createdOn);
                return orderDate >= dayStart && orderDate <= dayEnd;
            });

            dailyStats.push({
                date: currentDate.toISOString().split('T')[0],
                totalAmount: dayOrders.reduce((sum, order) => sum + Number(order.totalPrice), 0),
                orderCount: dayOrders.length,
                deliveredCount: dayOrders.reduce((count, order) => 
                    count + order.orderedItems.filter(item => item.status === 'Delivered').length, 0)
            });

            currentDate.setDate(currentDate.getDate() + 1);
        }

        // Calculate category statistics
        const categoryStats = {};
        filteredOrders.forEach(order => {
            order.orderedItems.forEach(item => {
                if (item.status === 'Delivered') {
                    const product = item.id;
                    if (product && product.category) {
                        const categoryName = product.category.name;
                        if (!categoryStats[categoryName]) {
                            categoryStats[categoryName] = {
                                totalSales: 0,
                                quantity: 0,
                                revenue: 0,
                                offerDiscount: 0
                            };
                        }
                        const itemPrice = Number(item.price);
                        const quantity = Number(item.quantity);
                        
                        categoryStats[categoryName].totalSales++;
                        categoryStats[categoryName].quantity += quantity;
                        categoryStats[categoryName].revenue += itemPrice * quantity;
                        
                        if (product.category.categoryOffer) {
                            categoryStats[categoryName].offerDiscount += 
                                (itemPrice * (product.category.categoryOffer / 100)) * quantity;
                        }
                    }
                }
            });
        });

        // Get top selling products
        const productStats = new Map();
        filteredOrders.forEach(order => {
            order.orderedItems.forEach(item => {
                if (item.status === 'Delivered' && item.id) {
                    const productId = item.id._id.toString();
                    const currentStats = productStats.get(productId) || {
                        name: item.id.name,
                        quantity: 0,
                        revenue: 0,
                        brand: item.id.brand?.name || 'N/A'
                    };
                    currentStats.quantity += Number(item.quantity);
                    currentStats.revenue += Number(item.price) * Number(item.quantity);
                    productStats.set(productId, currentStats);
                }
            });
        });

        const topProducts = Array.from(productStats.values())
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);

        res.render('admin/sales-report', {
            orders: filteredOrders,
            summary,
            paymentStats,
            categoryStats: Object.entries(categoryStats).map(([name, stats]) => ({
                name,
                ...stats
            })),
            dailyStats,
            topProducts,
            startDate: startOfMonth.toISOString().split('T')[0],
            endDate: endOfMonth.toISOString().split('T')[0]
        });

    } catch (error) {
        console.error('Error in getSalesReport:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

const generateReport = async (req, res) => {
    try {
        const { reportType, startDate, endDate } = req.body;
        let dateRange = {};

        switch (reportType) {
            case 'daily':
                const today = new Date();
                dateRange = {
                    start: new Date(today.setHours(0, 0, 0, 0)),
                    end: new Date(today.setHours(23, 59, 59, 999))
                };
                break;
            case 'weekly':
                const weekStart = new Date();
                weekStart.setDate(weekStart.getDate() - weekStart.getDay());
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekStart.getDate() + 6);
                dateRange = { start: weekStart, end: weekEnd };
                break;
            case 'monthly':
                const monthStart = new Date();
                monthStart.setDate(1);
                const monthEnd = new Date(monthStart);
                monthEnd.setMonth(monthStart.getMonth() + 1);
                monthEnd.setDate(0);
                dateRange = { start: monthStart, end: monthEnd };
                break;
            case 'yearly':
                const yearStart = new Date(new Date().getFullYear(), 0, 1);
                const yearEnd = new Date(new Date().getFullYear(), 11, 31, 23, 59, 59);
                dateRange = { start: yearStart, end: yearEnd };
                break;
            case 'custom':
                dateRange = {
                    start: new Date(startDate),
                    end: new Date(new Date(endDate).setHours(23, 59, 59))
                };
                break;
        }

        const orders = await Order.find({
            'orderedItems.status': 'Delivered'
        }).populate('userId').populate({
            path: 'orderedItems.id',
            populate: {
                path: 'category'
            }
        });

        // Filter orders within date range
        const filteredOrders = orders.filter(order => {
            const orderDate = new Date(order.orderDate);
            return orderDate >= dateRange.start && orderDate <= dateRange.end;
        });

        // Calculate summary
        const summary = {
            totalOrders: filteredOrders.length,
            totalAmount: filteredOrders.reduce((sum, order) => sum + order.totalPrice, 0),
            totalDiscount: filteredOrders.reduce((sum, order) => sum + (order.discount || 0), 0),
            averageOrderValue: 0,
            productOfferDiscount: 0,
            categoryOfferDiscount: 0,
            couponDiscount: filteredOrders.reduce((sum, order) => sum + (order.discount || 0), 0)
        };

        // Calculate product and category offer discounts
        filteredOrders.forEach(order => {
            order.orderedItems.forEach(item => {
                if (item.status === 'Delivered') {
                    const product = item.id;
                    if (product) {
                        // Calculate product offer discount
                        if (product.productOffer) {
                            summary.productOfferDiscount += (parseFloat(item.price) * (product.productOffer / 100)) * item.quantity;
                        }
                        // Calculate category offer discount
                        if (product.category?.categoryOffer) {
                            summary.categoryOfferDiscount += (parseFloat(item.price) * (product.category.categoryOffer / 100)) * item.quantity;
                        }
                    }
                }
            });
        });

        summary.averageOrderValue = summary.totalOrders > 0 ? summary.totalAmount / summary.totalOrders : 0;

        // Calculate payment stats
        const paymentStats = filteredOrders.reduce((stats, order) => {
            const method = order.paymentMethod?.toLowerCase() || 'other';
            if (!stats[method]) {
                stats[method] = { count: 0, amount: 0 };
            }
            stats[method].count++;
            stats[method].amount += order.totalPrice;
            return stats;
        }, {});

        // Calculate category stats
        const categoryStats = {};
        filteredOrders.forEach(order => {
            order.orderedItems.forEach(item => {
                if (item.status === 'Delivered') {
                    const product = item.id;
                    const categoryName = product?.category?.name || 'Uncategorized';
                    if (!categoryStats[categoryName]) {
                        categoryStats[categoryName] = {
                            totalSales: 0,
                            quantity: 0,
                            revenue: 0
                        };
                    }
                    categoryStats[categoryName].totalSales++;
                    categoryStats[categoryName].quantity += item.quantity;
                    categoryStats[categoryName].revenue += parseFloat(item.price) * item.quantity;
                }
            });
        });

        res.json({
            success: true,
            orders: filteredOrders,
            summary,
            paymentStats,
            categoryStats: Object.entries(categoryStats).map(([name, stats]) => ({
                name,
                ...stats
            }))
        });

    } catch (error) {
        console.error('Error in generateReport:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

const downloadReport = async (req, res) => {
    try {
        const { type } = req.params;
        const { startDate, endDate } = req.query;

        const orders = await Order.find({
            'orderedItems.status': 'Delivered'
        }).populate('userId').populate({
            path: 'orderedItems.id',
            populate: {
                path: 'category'
            }
        });

        // Filter orders within date range
        const filteredOrders = orders.filter(order => {
            const orderDate = new Date(order.orderDate);
            return orderDate >= new Date(startDate) && orderDate <= new Date(endDate);
        });

        const summary = {
            totalOrders: filteredOrders.length,
            totalAmount: filteredOrders.reduce((sum, order) => sum + order.totalPrice, 0),
            totalDiscount: filteredOrders.reduce((sum, order) => sum + (order.discount || 0), 0)
        };

        if (type === 'excel') {
            await generateExcelReport(filteredOrders, summary, res);
        } else if (type === 'pdf') {
            await generatePDFReport(filteredOrders, summary, res);
        } else {
            res.status(400).json({ success: false, message: 'Invalid report type' });
        }
    } catch (error) {
        console.error('Error in downloadReport:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

const generateExcelReport = async (orders, summary, res) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sales Report');

    // Add headers
    worksheet.addRow(['Order ID', 'Date', 'Customer', 'Items', 'Amount', 'Discount', 'Final Amount']);

    // Add order data
    orders.forEach(order => {
        worksheet.addRow([
            order.orderId,
            order.orderDate ? new Date(order.orderDate).toLocaleDateString() : 'N/A',
            order.userId?.name || 'N/A',
            order.orderedItems.map(item => `${item.name} (${item.quantity})`).join(', '),
            order.totalPrice,
            order.discount || 0,
            order.totalPrice - (order.discount || 0)
        ]);
    });

    // Add summary
    worksheet.addRow([]);
    worksheet.addRow(['Summary']);
    worksheet.addRow(['Total Orders', summary.totalOrders]);
    worksheet.addRow(['Total Amount', summary.totalAmount]);
    worksheet.addRow(['Total Discount', summary.totalDiscount]);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=sales-report.xlsx');

    await workbook.xlsx.write(res);
};

const generatePDFReport = async (orders, summary, res) => {
    const doc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=sales-report.pdf');
    doc.pipe(res);

    // Add title
    doc.fontSize(20).text('Sales Report', { align: 'center' });
    doc.moveDown();

    // Add orders
    doc.fontSize(12);
    orders.forEach(order => {
        doc.text(`Order ID: ${order.orderId}`);
        doc.text(`Date: ${order.orderDate ? new Date(order.orderDate).toLocaleDateString() : 'N/A'}`);
        doc.text(`Customer: ${order.userId?.name || 'N/A'}`);
        doc.text(`Items: ${order.orderedItems.map(item => `${item.name} (${item.quantity})`).join(', ')}`);
        doc.text(`Amount: ₹${order.totalPrice}`);
        doc.text(`Discount: ₹${order.discount || 0}`);
        doc.text(`Final Amount: ₹${order.totalPrice - (order.discount || 0)}`);
        doc.moveDown();
    });

    // Add summary
    doc.moveDown();
    doc.fontSize(14).text('Summary');
    doc.fontSize(12);
    doc.text(`Total Orders: ${summary.totalOrders}`);
    doc.text(`Total Amount: ₹${summary.totalAmount}`);
    doc.text(`Total Discount: ₹${summary.totalDiscount}`);

    doc.end();
};

module.exports = {
    getSalesReport,
    generateReport,
    downloadReport
};
