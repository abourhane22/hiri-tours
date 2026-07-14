import { Html, Head, Body, Container, Section, Heading, Text, Hr, Row, Column } from "@react-email/components";

type Props = {
  customerName: string;
  reference: string;
  circuitTitle: string;
  departureDate: string;
  adults: number;
  children: number;
  totalAmount: number;
  paidAmount: number;
  pickupLocation?: string | null;
};

function formatMAD(n: number) {
  return new Intl.NumberFormat("fr-MA", { maximumFractionDigits: 0 }).format(n) + " MAD";
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export default function VoucherDeliveryEmail(props: Props) {
  const balance = props.totalAmount - props.paidAmount;
  return (
    <Html lang="fr">
      <Head />
      <Body style={{ background: "#fbf6ec", fontFamily: "Helvetica, Arial, sans-serif", color: "#3a2e22", margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: 560, margin: "0 auto", padding: "32px 24px" }}>
          <Section style={{ paddingBottom: 16 }}>
            <Heading style={{ fontFamily: "Georgia, serif", fontSize: 28, color: "#1e3a5f", margin: 0 }}>Hiri Tours</Heading>
            <Text style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#c66c4e", margin: 4 }}>Votre voucher</Text>
          </Section>

          <Section style={{ background: "white", borderRadius: 8, padding: 28, border: "1px solid #e5d6c0" }}>
            <Text style={{ fontSize: 16, margin: "0 0 16px" }}>Bonjour {props.customerName},</Text>
            <Text style={{ fontSize: 14, margin: "0 0 20px", lineHeight: 1.6 }}>
              Voici votre voucher pour <strong>{props.circuitTitle}</strong>. Présentez la référence ci-dessous le jour du départ.
            </Text>

            <Section style={{ background: "#fbf6ec", border: "2px dashed #c66c4e", borderRadius: 6, padding: 16, textAlign: "center" as const, margin: "20px 0" }}>
              <Text style={{ fontSize: 10, color: "#7a6a55", margin: 0, letterSpacing: 2, textTransform: "uppercase" }}>Référence à présenter</Text>
              <Text style={{ fontSize: 22, fontFamily: "Courier New, monospace", color: "#c66c4e", fontWeight: 600, margin: "6px 0 0" }}>{props.reference}</Text>
            </Section>

            <Hr style={{ borderColor: "#e5d6c0", margin: "20px 0" }} />

            <Row style={{ marginBottom: 8 }}>
              <Column style={{ width: "40%", fontSize: 12, color: "#7a6a55" }}>Date de départ</Column>
              <Column style={{ fontSize: 14 }}>{formatDate(props.departureDate)}</Column>
            </Row>
            <Row style={{ marginBottom: 8 }}>
              <Column style={{ width: "40%", fontSize: 12, color: "#7a6a55" }}>Passagers</Column>
              <Column style={{ fontSize: 14 }}>{props.adults} adulte{props.adults > 1 ? "s" : ""}{props.children > 0 ? `, ${props.children} enfant${props.children > 1 ? "s" : ""}` : ""}</Column>
            </Row>
            {props.pickupLocation && (
              <Row style={{ marginBottom: 8 }}>
                <Column style={{ width: "40%", fontSize: 12, color: "#7a6a55" }}>Point de RDV</Column>
                <Column style={{ fontSize: 14 }}>{props.pickupLocation}</Column>
              </Row>
            )}

            <Hr style={{ borderColor: "#e5d6c0", margin: "20px 0" }} />

            <Row style={{ marginBottom: 6 }}>
              <Column style={{ width: "60%", fontSize: 13, color: "#7a6a55" }}>Total</Column>
              <Column style={{ fontSize: 13, textAlign: "right" as const }}>{formatMAD(props.totalAmount)}</Column>
            </Row>
            <Row style={{ marginBottom: 6 }}>
              <Column style={{ width: "60%", fontSize: 13, color: "#7a6a55" }}>Déjà réglé</Column>
              <Column style={{ fontSize: 13, textAlign: "right" as const, color: "#0f7b3f" }}>{formatMAD(props.paidAmount)}</Column>
            </Row>
            {balance > 0 && (
              <Row>
                <Column style={{ width: "60%", fontSize: 14, fontWeight: 600 }}>Solde à régler</Column>
                <Column style={{ fontSize: 16, fontWeight: 600, textAlign: "right" as const, color: "#c66c4e" }}>{formatMAD(balance)}</Column>
              </Row>
            )}
          </Section>

          <Section style={{ paddingTop: 24, fontSize: 12, color: "#7a6a55", textAlign: "center" as const }}>
            <Text style={{ margin: 0 }}>Bon voyage avec Hiri Tours</Text>
            <Text style={{ margin: "4px 0 0" }}>Agadir, Maroc</Text>
            <Text style={{ margin: "6px 0 0", fontSize: 10, color: "#9a8c73" }}>by Bright Strategy</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
