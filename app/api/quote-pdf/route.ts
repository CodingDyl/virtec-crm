import { NextRequest } from "next/server";
import { format } from "date-fns";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export const runtime = "nodejs";

interface QuoteFormData {
  projectType: string;
  complexity: "Low" | "Medium" | "High";
  urgency: "Standard" | "Rush" | "Extreme Rush";
  features: string[];
  estimatedHours: number;
  hourlyRate: number;
  hostingCost: number;
  maintenanceCost: number;
  documentType: "Quote" | "Invoice";
  discountType: "none" | "percentage" | "hourly" | "hours";
  discountValue: number;
}

interface QuotePayload {
  company: string;
  totalAmount: number;
  formData: QuoteFormData;
  clientData: {
    name: string;
    companyName: string;
    contactNumber: string;
    email: string;
  };
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
  totalBg: rgb(0.024, 0.039, 0.067),
  totalText: rgb(0.553, 0.965, 1),
};

const COMPLEXITY_MULTIPLIERS: Record<QuoteFormData["complexity"], number> = {
  Low: 1,
  Medium: 1.5,
  High: 2,
};

const URGENCY_MULTIPLIERS: Record<QuoteFormData["urgency"], number> = {
  Standard: 1,
  Rush: 1.2,
  "Extreme Rush": 1.4,
};

const parseBody = async (req: NextRequest): Promise<QuotePayload> => {
  const body = (await req.json()) as Partial<QuotePayload>;

  return {
    company: body.company || "Virtara",
    totalAmount: Number(body.totalAmount) || 0,
    formData: {
      projectType: body.formData?.projectType || "",
      complexity: body.formData?.complexity || "Medium",
      urgency: body.formData?.urgency || "Standard",
      features: Array.isArray(body.formData?.features) ? body.formData!.features : [],
      estimatedHours: Number(body.formData?.estimatedHours) || 0,
      hourlyRate: Number(body.formData?.hourlyRate) || 0,
      hostingCost: Number(body.formData?.hostingCost) || 0,
      maintenanceCost: Number(body.formData?.maintenanceCost) || 0,
      documentType: body.formData?.documentType || "Quote",
      discountType: body.formData?.discountType || "none",
      discountValue: Number(body.formData?.discountValue) || 0,
    },
    clientData: {
      name: body.clientData?.name || "",
      companyName: body.clientData?.companyName || "",
      contactNumber: body.clientData?.contactNumber || "",
      email: body.clientData?.email || "",
    },
  };
};

const currency = (value: number) => `R${Number(value || 0).toLocaleString()}`;

const originalAmount = (formData: QuoteFormData) => {
  const baseQuote = formData.estimatedHours * formData.hourlyRate;
  const complexityMultiplier = COMPLEXITY_MULTIPLIERS[formData.complexity];
  const urgencyMultiplier = URGENCY_MULTIPLIERS[formData.urgency];

  let adjusted = baseQuote * complexityMultiplier * urgencyMultiplier;

  switch (formData.discountType) {
    case "percentage":
      adjusted = adjusted / (1 - formData.discountValue / 100 || 1);
      break;
    case "hourly":
      adjusted = formData.estimatedHours * (formData.hourlyRate + formData.discountValue) * complexityMultiplier * urgencyMultiplier;
      break;
    case "hours":
      adjusted = (formData.estimatedHours + formData.discountValue) * formData.hourlyRate * complexityMultiplier * urgencyMultiplier;
      break;
  }

  return adjusted + formData.hostingCost + formData.maintenanceCost;
};

export async function POST(req: NextRequest) {
  try {
    const data = await parseBody(req);
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    let page = pdfDoc.addPage([PAGE.width, PAGE.height]);

    const drawPageBackground = () => {
      page.drawRectangle({
        x: 0,
        y: 0,
        width: PAGE.width,
        height: PAGE.height,
        color: COLORS.pageBg,
      });
    };

    drawPageBackground();

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
        drawPageBackground();
        y = PAGE.height - PAGE.margin;
      }
    };

    const card = (title: string, height: number) => {
      ensureSpace(height + 20);
      page.drawRectangle({
        x: PAGE.margin,
        y: y - height,
        width: PAGE.width - PAGE.margin * 2,
        height,
        color: COLORS.cardBg,
        borderColor: COLORS.cardBorder,
        borderWidth: 1,
      });
      drawText(title, PAGE.margin + 14, y - 20, 12, true, rgb(0.055, 0.208, 0.388));
    };

    const writeRow = (label: string, value: string, offsetY: number) => {
      drawText(label, PAGE.margin + 14, offsetY, 10, true, COLORS.textMuted);
      drawText(value || "-", PAGE.margin + 120, offsetY, 10, false, COLORS.textPrimary);
    };

    const headerHeight = 110;
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

    drawText("VIRTARA CRM", PAGE.margin + 16, y - 24, 10, true, COLORS.headerAccent);
    drawText(`${data.company} ${data.formData.documentType}`, PAGE.margin + 16, y - 48, 20, true, rgb(0.929, 0.957, 1));
    drawText(`Generated on ${format(new Date(), "MMMM dd, yyyy")}`, PAGE.margin + 16, y - 66, 10, false, rgb(0.72, 0.83, 0.94));
    drawText(`${data.formData.projectType} • ${data.formData.urgency} • ${data.formData.complexity}`, PAGE.margin + 16, y - 84, 10, false, rgb(0.72, 0.83, 0.94));

    y -= headerHeight + 22;

    card("Client Information", 92);
    writeRow("Client Name:", data.clientData.name || "Not available", y - 42);
    writeRow("Company:", data.clientData.companyName || "Not available", y - 58);
    writeRow("Contact:", data.clientData.contactNumber || "Not available", y - 74);
    writeRow("Email:", data.clientData.email || "Not available", y - 90);
    y -= 110;

    const projectCardHeight = 92 + Math.max(data.formData.features.length, 1) * 14;
    card("Project Details", projectCardHeight);
    writeRow("Project Type:", data.formData.projectType || "-", y - 42);
    writeRow("Estimated Hours:", `${data.formData.estimatedHours} hours`, y - 58);
    writeRow("Hourly Rate:", currency(data.formData.hourlyRate), y - 74);
    drawText("Features:", PAGE.margin + 14, y - 92, 10, true, COLORS.textMuted);
    (data.formData.features.length > 0 ? data.formData.features : ["None selected"]).forEach((feature, index) => {
      drawText(`• ${feature}`, PAGE.margin + 120, y - 92 - index * 14, 10, false, COLORS.textPrimary);
    });
    y -= projectCardHeight + 18;

    const services = [];
    if (data.formData.hostingCost > 0) services.push(`Hosting: ${currency(data.formData.hostingCost)}`);
    if (data.formData.maintenanceCost > 0) services.push(`Maintenance: ${currency(data.formData.maintenanceCost)}`);
    if (data.formData.discountType !== "none") {
      const suffix = data.formData.discountType === "percentage"
        ? `${data.formData.discountValue}%`
        : data.formData.discountType === "hourly"
          ? `${currency(data.formData.discountValue)} per hour`
          : `${data.formData.discountValue} hours`;
      services.push(`Discount: ${suffix}`);
    }

    if (services.length > 0) {
      const servicesHeight = 40 + services.length * 16;
      card("Additional Pricing Details", servicesHeight);
      services.forEach((service, index) => {
        drawText(service, PAGE.margin + 14, y - 42 - index * 16, 10, false, COLORS.textPrimary);
      });
      y -= servicesHeight + 18;
    }

    const fullAmount = originalAmount(data.formData);
    const savings = Math.max(0, fullAmount - data.totalAmount);

    ensureSpace(110);
    page.drawRectangle({
      x: PAGE.margin,
      y: y - 90,
      width: PAGE.width - PAGE.margin * 2,
      height: 90,
      color: COLORS.totalBg,
    });
    drawText("Final Amount", PAGE.margin + 16, y - 26, 13, true, rgb(0.75, 0.86, 0.98));
    drawText(currency(data.totalAmount), PAGE.margin + 16, y - 48, 22, true, COLORS.totalText);
    if (savings > 0) {
      drawText(`Savings applied: ${currency(savings)}`, PAGE.margin + 16, y - 68, 10, false, rgb(0.72, 0.83, 0.94));
    }

    y -= 110;
    ensureSpace(30);
    drawText(
      data.formData.documentType === "Quote"
        ? "This quote is valid for 30 days from the date of generation."
        : "This invoice is due within 30 days from the date of generation.",
      PAGE.margin,
      y,
      9.5,
      false,
      COLORS.textMuted,
    );
    drawText("All prices are in South African Rand (ZAR).", PAGE.margin, y - 12, 9.5, false, COLORS.textMuted);

    const pdfBytes = await pdfDoc.save();

    return new Response(new Uint8Array(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${data.formData.documentType.toLowerCase()}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Error generating quote PDF:", error);
    return new Response("Failed to generate quote PDF", { status: 500 });
  }
}
