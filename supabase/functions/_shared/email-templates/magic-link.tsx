/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Seu link de acesso à Horen Suplementos</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={brand}>HOREN SUPLEMENTOS</Heading>
        <Heading style={h1}>Seu link de acesso</Heading>
        <Text style={text}>
          Clique no botão abaixo para entrar na sua conta da {siteName}.
          Este link expira em breve.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Entrar
        </Button>
        <Text style={footer}>
          Se você não solicitou este link, ignore este e-mail com segurança.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

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
const button = {
  backgroundColor: '#002A3F',
  color: '#f0e6d2',
  fontSize: '15px',
  fontWeight: 'bold' as const,
  borderRadius: '12px',
  padding: '14px 28px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#8a96a0', margin: '32px 0 0', lineHeight: '1.5' }
