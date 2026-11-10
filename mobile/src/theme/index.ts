export const colors = {
  bg: "#FDF8F3",
  bgAlt: "#F6EFE5",
  card: "#FFFFFF",
  ink: "#2D2A2E",
  inkSoft: "#5A5560",
  muted: "#8E8893",
  sage: "#7A9B76",
  sageSoft: "#DCE8D8",
  lavender: "#9B8BAF",
  lavenderSoft: "#EAE3F2",
  peach: "#E8A87C",
  peachSoft: "#FBE7D6",
  blue: "#8FB8CA",
  blueSoft: "#DFEEF3",
  border: "#EBE3D6",
  danger: "#C45C5C",
  white: "#FFFFFF",
};

export const spacing = (n: number) => n * 4;

export const radius = { sm: 10, md: 16, lg: 24, xl: 32 };

export const shadow = {
  card: {
    shadowColor: "#2D2A2E",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
};

export const typography = {
  h1: { fontSize: 30, fontWeight: "700" as const, color: colors.ink, letterSpacing: -0.4 },
  h2: { fontSize: 22, fontWeight: "700" as const, color: colors.ink, letterSpacing: -0.2 },
  h3: { fontSize: 17, fontWeight: "600" as const, color: colors.ink },
  body: { fontSize: 15, color: colors.inkSoft, lineHeight: 22 },
  small: { fontSize: 13, color: colors.muted },
};