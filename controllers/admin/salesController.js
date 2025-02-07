const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

const getSalesReport = async (req, res) => {
    try {
        // Get date range from query parameters
        const { reportType, startDate, endDate } = req.query;
        let dateRange = {};

        // Set date range based on report type
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
                if (startDate && endDate) {
                    dateRange = {
                        start: new Date(new Date(startDate).setHours(0, 0, 0, 0)),
                        end: new Date(new Date(endDate).setHours(23, 59, 59, 999))
                    };
                }
                break;
            default:
                // Default to current month if no report type specified
                const defaultStart = new Date();
                defaultStart.setDate(1);
                const defaultEnd = new Date(defaultStart);
                defaultEnd.setMonth(defaultStart.getMonth() + 1);
                defaultEnd.setDate(0);
                dateRange = { start: defaultStart, end: defaultEnd };
        }

        // Get all orders with populated data
        const query = dateRange.start && dateRange.end ? {
            createdOn: {
                $gte: dateRange.start,
                $lte: dateRange.end
            }
        } : {};

        const orders = await Order.find(query)
            .populate('userId')
            .populate({
                path: 'orderedItems.id',
                populate: {
                    path: 'category'
                }
            })
            .sort({ createdOn: -1 });

        // Calculate summary statistics
        const summary = {
            totalOrders: orders.length,
            totalAmount: orders.reduce((sum, order) => sum + order.totalPrice, 0),
            totalDiscount: orders.reduce((sum, order) => sum + (order.discount || 0), 0),
            averageOrderValue: orders.length > 0 ? 
                orders.reduce((sum, order) => sum + order.totalPrice, 0) / orders.length : 0,
            productOfferDiscount: 0,
            categoryOfferDiscount: 0,
            couponDiscount: orders.reduce((sum, order) => sum + (order.discount || 0), 0),
            deliveredOrders: orders.filter(order => 
                order.orderedItems.some(item => item.status === 'Delivered')).length,
            pendingOrders: orders.filter(order => 
                order.orderedItems.some(item => item.status === 'Pending')).length,
            cancelledOrders: orders.filter(order => 
                order.orderedItems.some(item => item.status === 'Cancelled')).length,
            returnedOrders: orders.filter(order => 
                order.orderedItems.some(item => item.status === 'Returned')).length
        };

        // Calculate offer discounts
        orders.forEach(order => {
            order.orderedItems.forEach(item => {
                if (item.id) {
                    // Product offer discount
                    if (item.id.productOffer) {
                        summary.productOfferDiscount += 
                            (item.price * (item.id.productOffer / 100)) * item.quantity;
                    }
                    // Category offer discount
                    if (item.id.category?.categoryOffer) {
                        summary.categoryOfferDiscount += 
                            (item.price * (item.id.category.categoryOffer / 100)) * item.quantity;
                    }
                }
            });
        });

        res.render('admin/sales-report', {
            orders,
            summary,
            reportType: reportType || 'monthly',
            startDate: startDate || dateRange.start.toISOString().split('T')[0],
            endDate: endDate || dateRange.end.toISOString().split('T')[0]
        });

    } catch (error) {
        console.error('Error in getSalesReport:', error);
        res.redirect('/admin/dashboard'); // Redirect to dashboard on error
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
            const orderDate = new Date(order.createdOn);
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
                            summary.productOfferDiscount += 
                                (parseFloat(item.price) * (product.productOffer / 100)) * item.quantity;
                        }
                        // Calculate category offer discount
                        if (product.category?.categoryOffer) {
                            summary.categoryOfferDiscount += 
                                (parseFloat(item.price) * (product.category.categoryOffer / 100)) * item.quantity;
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
        res.redirect('/admin/dashboard'); // Redirect to dashboard on error
    }
};

// Helper function to format date
function formatDate(date) {
    if (!date) return 'N/A';
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return 'N/A';
        return d.toLocaleDateString('en-IN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    } catch (error) {
        return 'N/A';
    }
}

const generatePDFReport = async (orders, summary, res) => {
    try {
        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument({
            margin: 30,
            size: 'A4',
            bufferPages: true
        });

        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=sales-report.pdf');
        doc.pipe(res);

        // Add title and header
        doc.fontSize(20)
           .text('SIXIT - Sales Report', {
               align: 'center'
           })
           .moveDown();

        const currentDate = new Date();
        doc.fontSize(12)
           .text(`Generated on: ${formatDate(currentDate)} ${currentDate.toLocaleTimeString('en-IN')}`)
           .moveDown();

        // Add summary section
        doc.fontSize(16)
           .text('Sales Summary', { underline: true })
           .moveDown();

        // Summary tables
        const summaryData = [
            ['Total Orders', summary.totalOrders],
            ['Total Revenue', `₹${summary.totalAmount.toFixed(2)}`],
            ['Total Discount', `₹${summary.totalDiscount.toFixed(2)}`],
            ['Average Order Value', `₹${(summary.totalAmount / summary.totalOrders).toFixed(2)}`]
        ];

        const summaryTableTop = doc.y;
        const summaryColWidths = [200, 200];
        drawTable(doc, summaryData, summaryTableTop, summaryColWidths);
        doc.moveDown(2);

        // Order Status table
        doc.fontSize(16)
           .text('Order Status', { underline: true })
           .moveDown();

        const statusData = [
            ['Status', 'Count'],
            ['Delivered', orders.filter(o => o.orderedItems.some(i => i.status === 'Delivered')).length],
            ['Pending', orders.filter(o => o.orderedItems.some(i => i.status === 'Pending')).length],
            ['Cancelled', orders.filter(o => o.orderedItems.some(i => i.status === 'Cancelled')).length],
            ['Returned', orders.filter(o => o.orderedItems.some(i => i.status === 'Returned')).length]
        ];

        drawTable(doc, statusData, doc.y, summaryColWidths);
        doc.moveDown(2);

        // Detailed Orders table
        doc.fontSize(16)
           .text('Order Details', { underline: true })
           .moveDown();

        // Table headers
        const headers = ['Order ID', 'Date', 'Customer', 'Items', 'Status', 'Amount'];
        const colWidths = [70, 70, 90, 140, 70, 70];
        
        let currentY = doc.y;
        
        // Draw header row
        drawTableRow(doc, headers, currentY, colWidths, true);
        currentY += 20;

        // Draw order rows
        orders.forEach((order, index) => {
            // Check if we need a new page
            if (currentY > doc.page.height - 50) {
                doc.addPage();
                currentY = 50;
                // Redraw headers on new page
                drawTableRow(doc, headers, currentY, colWidths, true);
                currentY += 20;
            }

            const statuses = [...new Set(order.orderedItems.map(item => item.status))];
            const formattedDate = formatDate(order.createdOn);
            const rowData = [
                order._id.toString().slice(-6),
                formattedDate,
                order.userId?.name || 'N/A',
                order.orderedItems.map(item => 
                    `${item.name} (×${item.quantity})`
                ).join(', '),
                statuses.join(', '),
                `₹${order.totalPrice.toFixed(2)}`
            ];

            drawTableRow(doc, rowData, currentY, colWidths);
            currentY += 20;
        });

        // Add page numbers
        const pageCount = doc.bufferedPageRange().count;
        for (let i = 0; i < pageCount; i++) {
            doc.switchToPage(i);
            doc.fontSize(8)
               .text(
                   `Page ${i + 1} of ${pageCount}`,
                   30,
                   doc.page.height - 20,
                   { align: 'center' }
               );
        }

        // Finalize PDF
        doc.end();

    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error generating PDF report',
            error: error.message 
        });
    }
};

// Helper function to draw a table row
function drawTableRow(doc, rowData, y, colWidths, isHeader = false) {
    let x = 30; // Starting x position
    const rowHeight = isHeader ? 25 : 20;
    
    // Set background for header
    if (isHeader) {
        doc.fillColor('#f0f0f0')
           .rect(x, y - 5, colWidths.reduce((sum, w) => sum + w, 0), rowHeight)
           .fill();
    }

    // Draw vertical lines
    doc.strokeColor('#000000');
    let currentX = x;
    colWidths.forEach(width => {
        doc.moveTo(currentX, y - 5)
           .lineTo(currentX, y + rowHeight - 5)
           .stroke();
        currentX += width;
    });
    doc.moveTo(currentX, y - 5)
       .lineTo(currentX, y + rowHeight - 5)
       .stroke();

    // Draw horizontal lines
    doc.moveTo(x, y - 5)
       .lineTo(x + colWidths.reduce((sum, w) => sum + w, 0), y - 5)
       .stroke();
    doc.moveTo(x, y + rowHeight - 5)
       .lineTo(x + colWidths.reduce((sum, w) => sum + w, 0), y + rowHeight - 5)
       .stroke();

    // Add text
    doc.fillColor('#000000');
    rowData.forEach((text, i) => {
        const fontSize = isHeader ? 10 : 8;
        const cellPadding = 5;
        const cellWidth = colWidths[i] - (cellPadding * 2);
        
        doc.fontSize(fontSize)
           .text(
                text.toString(),
                x + cellPadding,
                y + (isHeader ? 2 : 0),
                {
                    width: cellWidth,
                    align: i === rowData.length - 1 ? 'right' : 'left',
                    lineGap: 2
                }
            );
        x += colWidths[i];
    });
}

// Helper function to draw a complete table
function drawTable(doc, data, startY, colWidths) {
    let currentY = startY;
    
    data.forEach((row, i) => {
        drawTableRow(doc, row, currentY, colWidths, i === 0);
        currentY += 20;
    });
    
    return currentY;
}

const generateExcelReport = async (orders, summary, res) => {
    try {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'SIXIT';
        workbook.lastModifiedBy = 'SIXIT';
        workbook.created = new Date();
        workbook.modified = new Date();

        // Sales Summary Sheet
        const summarySheet = workbook.addWorksheet('Sales Summary');
        summarySheet.columns = [
            { header: 'Metric', key: 'metric', width: 25 },
            { header: 'Value', key: 'value', width: 20, style: { numFmt: '#,##0.00' } }
        ];

        // Add title
        summarySheet.mergeCells('A1:B1');
        summarySheet.getCell('A1').value = 'SIXIT - Sales Report';
        summarySheet.getCell('A1').font = { size: 16, bold: true };
        summarySheet.getCell('A1').alignment = { horizontal: 'center' };
        summarySheet.addRow([]); // Empty row for spacing

        // Add date
        summarySheet.mergeCells('A3:B3');
        summarySheet.getCell('A3').value = `Generated on: ${formatDate(new Date())}`;
        summarySheet.getCell('A3').font = { italic: true };
        summarySheet.addRow([]); // Empty row for spacing

        // Add summary section title
        summarySheet.mergeCells('A5:B5');
        summarySheet.getCell('A5').value = 'Sales Summary';
        summarySheet.getCell('A5').font = { size: 14, bold: true };
        summarySheet.addRow([]); // Empty row for spacing

        // Add summary data with styling
        const summaryData = [
            { metric: 'Total Orders', value: summary.totalOrders },
            { metric: 'Total Revenue', value: summary.totalAmount },
            { metric: 'Total Discount', value: summary.totalDiscount },
            { metric: 'Average Order Value', value: summary.totalAmount / summary.totalOrders },
            { metric: 'Product Offer Discounts', value: summary.productOfferDiscount },
            { metric: 'Category Offer Discounts', value: summary.categoryOfferDiscount },
            { metric: 'Coupon Discounts', value: summary.couponDiscount }
        ];

        // Add and style summary data
        summaryData.forEach((data, index) => {
            const row = summarySheet.addRow(data);
            row.getCell(1).font = { bold: true };
            row.getCell(2).numFmt = '₹#,##0.00';
        });

        // Add spacing
        summarySheet.addRow([]);

        // Add order status section
        summarySheet.mergeCells('A15:B15');
        summarySheet.getCell('A15').value = 'Order Status Summary';
        summarySheet.getCell('A15').font = { size: 14, bold: true };
        summarySheet.addRow([]); // Empty row for spacing

        const statusData = [
            { metric: 'Delivered Orders', value: summary.deliveredOrders },
            { metric: 'Pending Orders', value: summary.pendingOrders },
            { metric: 'Cancelled Orders', value: summary.cancelledOrders },
            { metric: 'Returned Orders', value: summary.returnedOrders }
        ];

        // Add and style status data
        statusData.forEach((data) => {
            const row = summarySheet.addRow(data);
            row.getCell(1).font = { bold: true };
        });

        // Style all borders in summary sheet
        summarySheet.eachRow((row) => {
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        });

        // Detailed Orders Sheet
        const ordersSheet = workbook.addWorksheet('Order Details');
        ordersSheet.columns = [
            { header: 'Order ID', key: 'orderId', width: 15 },
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Customer', key: 'customer', width: 25 },
            { header: 'Items', key: 'items', width: 40 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Amount', key: 'amount', width: 15, style: { numFmt: '₹#,##0.00' } },
            { header: 'Discount', key: 'discount', width: 15, style: { numFmt: '₹#,##0.00' } },
            { header: 'Final Amount', key: 'finalAmount', width: 15, style: { numFmt: '₹#,##0.00' } }
        ];

        // Style the header row
        ordersSheet.getRow(1).font = { bold: true };
        ordersSheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };
        ordersSheet.getRow(1).alignment = { horizontal: 'center' };

        // Add order data
        orders.forEach(order => {
            const row = ordersSheet.addRow({
                orderId: order._id.toString().slice(-6),
                date: formatDate(order.createdOn),
                customer: order.userId?.name || 'N/A',
                items: order.orderedItems.map(item => `${item.name} (×${item.quantity})`).join('\n'),
                status: [...new Set(order.orderedItems.map(item => item.status))].join(', '),
                amount: Number(order.totalPrice),
                discount: Number(order.discount || 0),
                finalAmount: Number(order.finalAmount)
            });

            // Style each row
            row.eachCell((cell, colNumber) => {
                // Set borders
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };

                // Set alignment based on column content
                if (colNumber === 4) { // Items column
                    cell.alignment = { 
                        vertical: 'middle', 
                        horizontal: 'left',
                        wrapText: true 
                    };
                } else if (colNumber >= 6) { // Amount columns
                    cell.alignment = { 
                        vertical: 'middle', 
                        horizontal: 'right' 
                    };
                } else {
                    cell.alignment = { 
                        vertical: 'middle', 
                        horizontal: 'left' 
                    };
                }
            });

            // Adjust row height for wrapped text
            row.height = 25;
        });

        // Auto-filter for easy sorting
        ordersSheet.autoFilter = {
            from: 'A1',
            to: `H${orders.length + 1}`
        };

        // Freeze the header row
        ordersSheet.views = [
            { state: 'frozen', ySplit: 1 }
        ];

        // Set content type and headers for Excel file
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=sales-report-${formatDate(new Date()).replace(/\//g, '-')}.xlsx`);

        // Write to response
        await workbook.xlsx.write(res);

    } catch (error) {
        console.error('Error generating Excel:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error generating Excel report',
            error: error.message 
        });
    }
};

const downloadReport = async (req, res) => {
    try {
        const { reportType, startDate, endDate } = req.query;
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

        // Get all orders with populated data
        const orders = await Order.find({})
            .populate('userId')
            .populate({
                path: 'orderedItems.id',
                populate: {
                    path: 'category'
                }
            })
            .sort({ createdOn: -1 });

        // Calculate summary
        const summary = {
            totalOrders: orders.length,
            totalAmount: orders.reduce((sum, order) => sum + order.totalPrice, 0),
            totalDiscount: orders.reduce((sum, order) => sum + (order.discount || 0), 0),
            averageOrderValue: orders.length > 0 ? 
                orders.reduce((sum, order) => sum + order.totalPrice, 0) / orders.length : 0,
            productOfferDiscount: 0,
            categoryOfferDiscount: 0,
            couponDiscount: orders.reduce((sum, order) => sum + (order.discount || 0), 0),
            deliveredOrders: orders.filter(order => 
                order.orderedItems.some(item => item.status === 'Delivered')).length,
            pendingOrders: orders.filter(order => 
                order.orderedItems.some(item => item.status === 'Pending')).length,
            cancelledOrders: orders.filter(order => 
                order.orderedItems.some(item => item.status === 'Cancelled')).length,
            returnedOrders: orders.filter(order => 
                order.orderedItems.some(item => item.status === 'Returned')).length
        };

        // Calculate offer discounts
        orders.forEach(order => {
            order.orderedItems.forEach(item => {
                if (item.id) {
                    // Product offer discount
                    if (item.id.productOffer) {
                        summary.productOfferDiscount += 
                            (item.price * (item.id.productOffer / 100)) * item.quantity;
                    }
                    // Category offer discount
                    if (item.id.category?.categoryOffer) {
                        summary.categoryOfferDiscount += 
                            (item.price * (item.id.category.categoryOffer / 100)) * item.quantity;
                    }
                }
            });
        });

        // Filter orders based on date range
        const filteredOrders = orders.filter(order => {
            const orderDate = new Date(order.createdOn);
            return orderDate >= dateRange.start && orderDate <= dateRange.end;
        });

        const format = req.params.format;
        if (format === 'pdf') {
            await generatePDFReport(filteredOrders, summary, res);
        } else if (format === 'excel') {
            await generateExcelReport(filteredOrders, summary, res);
        } else {
            res.status(400).json({ success: false, message: 'Invalid format specified' });
        }

    } catch (error) {
        console.error('Error in downloadReport:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error generating report',
            error: error.message 
        });
    }
};

module.exports = {
    getSalesReport,
    generateReport,
    downloadReport
};
