/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Seu código de verificação Horen</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={brand}>HOREN SUPLEMENTOS</Heading>
        <Heading style={h1}>Confirme sua identidade</Heading>
        <Text style={text}>Use o código abaixo para confirmar a sua identidade:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>
          Este código expira em breve. Se você não solicitou, ignore este
          e-mail com segurança.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Space Grotesk', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '560px' }
const brand = {
  fontSize: '12px',
  letterSpacing: '3px',
  color: '#002A3F',
  fontWeight: 'bold' as const,
  margin: '0 0 24px',
  fontFamily: "'Outfit', Arial, sans-serif",
}
const h1 = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: '#002A3F',
  margin: '0 0 20px',
  fontFamily: "'Outfit', Arial, sans-serif",
}
const text = {
  fontSize: '15px',
  color: '#3a4a55',
  lineHeight: '1.6',
  margin: '0 0 24px',
}
const codeStyle = {
  fontFamily: 'Courier, monospace',
  fontSize: '28px',
  letterSpacing: '4px',
  fontWeight: 'bold' as const,
  color: '#002A3F',
  backgroundColor: '#f5efe2',
  padding: '16px 20px',
  borderRadius: '12px',
  margin: '0 0 30px',
  textAlign: 'center' as const,
}
const footer = { fontSize: '12px', color: '#8a96a0', margin: '32px 0 0', lineHeight: '1.5' }
