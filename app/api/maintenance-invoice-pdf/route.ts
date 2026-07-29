import { NextRequest, NextResponse } from "next/server";
import { getOperator } from "@/lib/auth-server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { format } from "date-fns";

export const runtime = "nodejs";

interface InvoiceItemPayload {
  title: string;
  hours: number;
  amount: number;
}

interface InvoicePayload {
  company: string;
  date: string;
  invoiceNumber: string;
  customer: {
    name: string;
    companyName: string;
    contactNumber: string;
  };
  items: InvoiceItemPayload[];
  totalAmount: number;
}

const PAGE = {
  width: 595.28,
  height: 841.89,
  margin: 40,
};

const COLORS = {
  pageBg: rgb(0.968, 0.984, 1),
  headerBg: rgb(0.024, 0.039, 0.067),
  headerAccent: rgb(0.553, 0.965, 1),
  textPrimary: rgb(0.09, 0.16, 0.26),
  textMuted: rgb(0.33, 0.44, 0.56),
  cardBg: rgb(1, 1, 1),
  cardBorder: rgb(0.843, 0.91, 0.984),
  tableHeaderBg: rgb(0.024, 0.039, 0.067),
  tableHeaderText: rgb(0.929, 0.957, 1),
  tableStripe: rgb(0.961, 0.98, 1),
  totalBg: rgb(0.024, 0.039, 0.067),
  totalText: rgb(0.553, 0.965, 1),
};

const parseBody = async (req: NextRequest): Promise<InvoicePayload> => {
  const body = (await req.json()) as Partial<InvoicePayload>;
  return {
    company: body.company || "Virtara",
    date: body.date || new Date().toISOString(),
    invoiceNumber: body.invoiceNumber || "N/A",
    customer: {
      name: body.customer?.name || "",
      companyName: body.customer?.companyName || "",
      contactNumber: body.customer?.contactNumber || "",
    },
    items: Array.isArray(body.items)
      ? body.items.map((item) => ({
          title: item?.title || "",
          hours: Number(item?.hours) || 0,
          amount: Number(item?.amount) || 0,
        }))
      : [],
    totalAmount: Number(body.totalAmount) || 0,
  };
};

export async function POST(req: NextRequest) {
  // Renders live business data into a document; operators only.
  const operator = await getOperator();
  if (!operator) {
    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }

  try {
    const data = await parseBody(req);
    const safeDate = new Date(data.date);
    const formattedDate = Number.isNaN(safeDate.getTime()) ? "N/A" : format(safeDate, "MMMM dd, yyyy");

    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([PAGE.width, PAGE.height]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let y = PAGE.height - PAGE.margin;

    const drawText = (
      text: string,
      x: number,
      yPos: number,
      size = 11,
      bold = false,
      color = COLORS.textPrimary,
    ) => {
      page.drawText(text, {
        x,
        y: yPos,
        size,
        font: bold ? fontBold : font,
        color,
      });
    };

    const ensureSpace = (required: number) => {
      if (y - required < PAGE.margin) {
        page = pdfDoc.addPage([PAGE.width, PAGE.height]);
        page.drawRectangle({
          x: 0,
          y: 0,
          width: PAGE.width,
          height: PAGE.height,
          color: COLORS.pageBg,
        });
        y = PAGE.height - PAGE.margin;
      }
    };

    const drawKeyValue = (label: string, value: string, x: number, yPos: number) => {
      drawText(label, x, yPos, 10, true, COLORS.textMuted);
      drawText(value || "-", x + 70, yPos, 10, false, COLORS.textPrimary);
    };

    const safeCurrency = (value: number) => `R${Number(value || 0).toLocaleString()}`;

    page.drawRectangle({
      x: 0,
      y: 0,
      width: PAGE.width,
      height: PAGE.height,
      color: COLORS.pageBg,
    });

    const headerHeight = 120;
    page.drawRectangle({
      x: PAGE.margin,
      y: y - headerHeight,
      width: PAGE.width - PAGE.margin * 2,
      height: headerHeight,
      color: COLORS.headerBg,
    });
    page.drawRectangle({
      x: PAGE.margin,
      y: y - headerHeight,
      width: PAGE.width - PAGE.margin * 2,
      height: 6,
      color: COLORS.headerAccent,
    });

    drawText("VIRTARA", PAGE.margin + 16, y - 24, 10, true, COLORS.headerAccent);
    drawText(`${data.company} Maintenance Invoice`, PAGE.margin + 16, y - 48, 21, true, COLORS.tableHeaderText);
    drawText(`Generated on ${formattedDate}`, PAGE.margin + 16, y - 67, 10, false, rgb(0.72, 0.83, 0.94));
    drawText(`Invoice #${data.invoiceNumber}`, PAGE.margin + 16, y - 82, 10, false, rgb(0.72, 0.83, 0.94));

    const chipWidth = 150;
    const chipHeight = 48;
    const chipX = PAGE.width - PAGE.margin - chipWidth - 16;
    const chipY = y - 74;
    page.drawRectangle({
      x: chipX,
      y: chipY,
      width: chipWidth,
      height: chipHeight,
      color: rgb(0.11, 0.2, 0.31),
    });
    drawText("TOTAL DUE", chipX + 12, chipY + 30, 8.5, true, rgb(0.67, 0.84, 1));
    drawText(safeCurrency(data.totalAmount), chipX + 12, chipY + 12, 14, true, COLORS.headerAccent);

    y -= headerHeight + 22;

    const cardHeight = 94;
    page.drawRectangle({
      x: PAGE.margin,
      y: y - cardHeight,
      width: PAGE.width - PAGE.margin * 2,
      height: cardHeight,
      color: COLORS.cardBg,
      borderColor: COLORS.cardBorder,
      borderWidth: 1,
    });
    drawText("Client Information", PAGE.margin + 14, y - 22, 12, true, rgb(0.055, 0.208, 0.388));
    drawKeyValue("Name:", data.customer.name, PAGE.margin + 14, y - 42);
    drawKeyValue("Company:", data.customer.companyName, PAGE.margin + 14, y - 58);
    drawKeyValue("Contact:", data.customer.contactNumber, PAGE.margin + 14, y - 74);
    y -= cardHeight + 18;

    drawText("Maintenance Items", PAGE.margin, y, 13, true, rgb(0.055, 0.208, 0.388));
    y -= 14;

    const tableX = PAGE.margin;
    const tableWidth = PAGE.width - PAGE.margin * 2;
    const colTitleW = 300;
    const colHoursW = 90;
    const rowH = 26;

    const drawTableHeader = () => {
      ensureSpace(rowH + 10);
      page.drawRectangle({
        x: tableX,
        y: y - rowH,
        width: tableWidth,
        height: rowH,
        color: COLORS.tableHeaderBg,
      });
      drawText("Description", tableX + 10, y - 17, 10, true, COLORS.tableHeaderText);
      drawText("Hours", tableX + colTitleW + 10, y - 17, 10, true, COLORS.tableHeaderText);
      drawText("Amount", tableX + colTitleW + colHoursW + 10, y - 17, 10, true, COLORS.tableHeaderText);
      y -= rowH;
    };

    drawTableHeader();

    if (data.items.length === 0) {
      ensureSpace(rowH + 24);
      page.drawRectangle({
        x: tableX,
        y: y - rowH,
        width: tableWidth,
        height: rowH,
        color: COLORS.cardBg,
        borderColor: COLORS.cardBorder,
        borderWidth: 1,
      });
      drawText("No line items provided.", tableX + 10, y - 17, 10, false, COLORS.textMuted);
      y -= rowH;
    } else {
      data.items.forEach((item, index) => {
        ensureSpace(rowH + 12);
        const isStriped = index % 2 === 1;
        page.drawRectangle({
          x: tableX,
          y: y - rowH,
          width: tableWidth,
          height: rowH,
          color: isStriped ? COLORS.tableStripe : COLORS.cardBg,
          borderColor: COLORS.cardBorder,
          borderWidth: 1,
        });

        drawText((item.title || "-").slice(0, 55), tableX + 10, y - 17, 10, false, COLORS.textPrimary);
        drawText(`${item.hours}h`, tableX + colTitleW + 10, y - 17, 10, false, COLORS.textPrimary);
        drawText(safeCurrency(item.amount), tableX + colTitleW + colHoursW + 10, y - 17, 10, true, COLORS.textPrimary);
        y -= rowH;
      });
    }

    y -= 14;
    ensureSpace(68);
    page.drawRectangle({
      x: tableX,
      y: y - 54,
      width: tableWidth,
      height: 54,
      color: COLORS.totalBg,
    });
    drawText("Total Amount Due", tableX + 14, y - 21, 12, true, rgb(0.75, 0.86, 0.98));
    drawText(safeCurrency(data.totalAmount), tableX + 14, y - 40, 16, true, COLORS.totalText);

    y -= 76;
    ensureSpace(30);
    drawText("Payment due within 30 days of issue date.", tableX, y, 9.5, false, COLORS.textMuted);
    drawText("Thank you for your continued partnership with Virtara.", tableX, y - 12, 9.5, false, COLORS.textMuted);

    const pdfBytes = await pdfDoc.save();

    return new Response(new Uint8Array(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Error generating maintenance invoice PDF:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: "Failed to generate PDF", details: message }, { status: 500 });
  }
}
