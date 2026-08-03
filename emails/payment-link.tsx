import { Html, Head, Body, Container, Section, Heading, Text, Hr, Row, Column, Button } from "@react-email/components";

type Props = {
  customerName: string;
  reference: string;
  circuitTitle: string;
  departureDate: string;
  remaining: number;
  url: string;
  expiresAt: string;
};

function formatMAD(n: number) {
  return new Intl.NumberFormat("fr-MA", { maximumFractionDigits: 0 }).format(n) + " MAD";
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function formatDateTime(d: string) {
  return new Date(d).toLocaleString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PaymentLinkEmail(props: Props) {
  return (
    <Html lang="fr">
      <Head />
      <Body style={{ background: "#fbf6ec", fontFamily: "Helvetica, Arial, sans-serif", color: "#3a2e22", margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: 560, margin: "0 auto", padding: "32px 24px" }}>
          <Section style={{ paddingBottom: 16 }}>
            <Heading style={{ fontFamily: "Georgia, serif", fontSize: 28, color: "#1e3a5f", margin: 0 }}>Hiri Tours</Heading>
            <Text style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#c66c4e", margin: 4 }}>Règlement en ligne</Text>
          </Section>

          <Section style={{ background: "white", borderRadius: 8, padding: 28, border: "1px solid #e5d6c0" }}>
            <Text style={{ fontSize: 16, margin: "0 0 16px" }}>Bonjour {props.customerName},</Text>
            <Text style={{ fontSize: 14, margin: "0 0 20px", lineHeight: 1.6 }}>
              Vous pouvez régler votre réservation <strong>{props.reference}</strong> en ligne, en toute sécurité, en cliquant sur le bouton ci-dessous.
            </Text>

            <Row style={{ marginBottom: 8 }}>
              <Column style={{ width: "40%", fontSize: 12, color: "#7a6a55" }}>Prestation</Column>
              <Column style={{ fontSize: 14 }}>{props.circuitTitle}</Column>
            </Row>
            <Row style={{ marginBottom: 8 }}>
              <Column style={{ width: "40%", fontSize: 12, color: "#7a6a55" }}>Date de départ</Column>
              <Column style={{ fontSize: 14 }}>{formatDate(props.departureDate)}</Column>
            </Row>
            <Row>
              <Column style={{ width: "40%", fontSize: 13, color: "#7a6a55" }}>Montant à régler</Column>
              <Column style={{ fontSize: 16, fontWeight: 600, color: "#c66c4e" }}>{formatMAD(props.remaining)}</Column>
            </Row>

            <Section style={{ textAlign: "center" as const, margin: "28px 0 8px" }}>
              <Button
                href={props.url}
                style={{ background: "#1e3a5f", color: "white", fontSize: 15, fontWeight: 600, borderRadius: 8, padding: "12px 28px", textDecoration: "none" }}
              >
                Régler ma réservation
              </Button>
            </Section>

            <Hr style={{ borderColor: "#e5d6c0", margin: "20px 0" }} />

            <Text style={{ fontSize: 12, color: "#7a6a55", margin: 0, textAlign: "center" as const }}>
              Lien valable 24 heures, jusqu&apos;au {formatDateTime(props.expiresAt)}.
            </Text>
          </Section>

          <Section style={{ paddingTop: 24, fontSize: 12, color: "#7a6a55", textAlign: "center" as const }}>
            <Text style={{ margin: 0 }}>Hiri Tours — Agadir, Maroc</Text>
            <Text style={{ margin: "6px 0 0", fontSize: 10, color: "#9a8c73" }}>by Bright Strategy</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
