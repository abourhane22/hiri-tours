import { Html, Head, Body, Container, Section, Heading, Text, Hr, Row, Column } from "@react-email/components";

type Props = {
  customerName: string;
  reference: string;
  circuitTitle: string;
  departureDate: string;
  adults: number;
  children: number;
  totalAmount: number;
  pickupLocation?: string | null;
};

function formatMAD(n: number) {
  return new Intl.NumberFormat("fr-MA", { maximumFractionDigits: 0 }).format(n) + " MAD";
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export default function BookingConfirmationEmail(props: Props) {
  return (
    <Html lang="fr">
      <Head />
      <Body style={{ background: "#fbf6ec", fontFamily: "Helvetica, Arial, sans-serif", color: "#3a2e22", margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: 560, margin: "0 auto", padding: "32px 24px" }}>
          <Section style={{ paddingBottom: 16 }}>
            <Heading style={{ fontFamily: "Georgia, serif", fontSize: 28, color: "#1e3a5f", margin: 0 }}>Hiri Tours</Heading>
            <Text style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#c66c4e", margin: 4 }}>Confirmation de réservation</Text>
          </Section>

          <Section style={{ background: "white", borderRadius: 8, padding: 28, border: "1px solid #e5d6c0" }}>
            <Text style={{ fontSize: 16, margin: "0 0 16px" }}>Bonjour {props.customerName},</Text>
            <Text style={{ fontSize: 14, margin: "0 0 20px", lineHeight: 1.6 }}>
              Nous avons bien enregistré votre réservation pour <strong>{props.circuitTitle}</strong>. Vous trouverez ci-dessous le récapitulatif. Notre équipe vous recontactera prochainement pour confirmer les détails.
            </Text>

            <Hr style={{ borderColor: "#e5d6c0", margin: "20px 0" }} />

            <Row style={{ marginBottom: 8 }}>
              <Column style={{ width: "40%", fontSize: 12, color: "#7a6a55" }}>Référence</Column>
              <Column style={{ fontSize: 14, fontFamily: "Courier New, monospace", color: "#c66c4e", fontWeight: 600 }}>{props.reference}</Column>
            </Row>
            <Row style={{ marginBottom: 8 }}>
              <Column style={{ width: "40%", fontSize: 12, color: "#7a6a55" }}>Excursion</Column>
              <Column style={{ fontSize: 14 }}>{props.circuitTitle}</Column>
            </Row>
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

            <Row>
              <Column style={{ width: "40%", fontSize: 13, color: "#7a6a55" }}>Total réservation</Column>
              <Column style={{ fontSize: 18, fontFamily: "Georgia, serif", color: "#c66c4e", fontWeight: 600 }}>{formatMAD(props.totalAmount)}</Column>
            </Row>
          </Section>

          <Section style={{ paddingTop: 24, fontSize: 12, color: "#7a6a55", textAlign: "center" as const }}>
            <Text style={{ margin: 0 }}>Pour toute question, contactez-nous.</Text>
            <Text style={{ margin: "4px 0 0" }}>Hiri Tours · Agadir, Maroc</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
