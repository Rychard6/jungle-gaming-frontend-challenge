import type {
  AuthSessionDto,
  CartDto,
  CartItemDto,
  CreateOrderRequestDto,
  OrderDto,
  OrderStatus,
  CheckoutQuoteDto,
  NftCollectionCategory,
  NftItem,
  UpdateProfileRequestDto,
  UserProfileDto,
  WalletInputDto,
  WalletDto,
} from '../shared/api/types'
import {
  addEth,
  calculatePercentageDiscountEth,
  compareEth,
  multiplyEthByQuantity,
  subtractEth,
} from '../shared/lib/eth-math'

const STORAGE_KEY = 'kurio_mock_db_v1'
const FAVORITES_STORAGE_KEY = 'kurio_mock_favorites_v1'
const CART_STORAGE_KEY = 'kurio_mock_carts_v1'
// v2: senhas migraram de FNV-1a para PBKDF2 e pedidos guardam a impressão digital exata do payload.
const AUTH_STORAGE_KEY = 'kurio_mock_auth_v2'
const ORDERS_STORAGE_KEY = 'kurio_mock_orders_v2'

// Hashes PBKDF2-SHA256 (100.000 iterações, salt fixo apenas nas fixtures) da senha fictícia "Kurio@2026".
const FIXTURE_PASSWORD_HASHES = {
  nova: 'pbkdf2-sha256$100000$a3VyaW8tbm92YS1zYXRvIQ==$udC5nv07MDEYMr3v/yQk+4CLXvjPLX7iJRF0MlqQIA0=',
  kael: 'pbkdf2-sha256$100000$a3VyaW8ta2FlbC12YW5jZQ==$tVXFjC+uj42ceyDeXhIBSaEGS7WrSc9QJr42G2jf8so=',
} as const
const PASSWORD_HASH_ITERATIONS = 100_000

interface StoredMockUser {
  profile: UserProfileDto
  passwordHash: string
  wallets: WalletDto[]
}

interface StoredMockSession {
  userId: string
  expiresAt: string
}

interface StoredAuthState {
  users: StoredMockUser[]
  sessions: Record<string, StoredMockSession>
}

interface StoredMockOrder {
  order: OrderDto
  /** Representação canônica do payload; comparação exata em vez de hash curto. */
  payloadFingerprint: string
}

interface StoredCartItem {
  itemId: string
  nftId: string
  quantity: number
  editionType: NftItem['editionType']
  addedPriceEth: string
  addedVersion: number
}

interface StoredCart {
  items: StoredCartItem[]
  couponCode: string | null
}

const couponDefinitions = {
  KURIO10: {
    label: 'Desconto do lançamento (KURIO10 -10%)',
  },
  LANCAMENTO1ETH: {
    label: 'Desconto do lançamento (LANCAMENTO1ETH -1.00 ETH)',
  },
} as const

const originalFixtures: NftItem[] = [
  {
    id: 'emerald-ape-042',
    tokenId: '#0042',
    slug: 'emerald-ape-042',
    title: 'Emerald Ape #042',
    collectionName: 'Kurio Apes',
    category: 'Arte digital',
    network: 'Ethereum',
    priceEth: '1.19',
    editionType: '1/50',
    availableEditions: 50,
    totalEditions: 50,
    imageUrl: '/mock-assets/nfts/ape-emerald.png',
    galleryUrls: [
      '/mock-assets/nfts/ape-emerald.png',
      '/mock-assets/nfts/ape-cosmic.png',
      '/mock-assets/nfts/ape-ivory.png',
      '/mock-assets/nfts/ape-golden.png',
    ],
    isFeatured: true,
    isLaunch: true,
    rating: 4.9,
    reviewsCount: 124,
    description: 'Um colecionável digital da coleção Kurio Apes.',
    longDescription:
      'Emerald Ape #042 é uma peça exclusiva da coleção Kurio Apes, criada para colecionadores de arte digital.',
    attributes: ['Esmeralda', 'Ape', 'Edição limitada'],
    contractAddress: '0x0000000000000000000000000000000000000042',
    creatorRoyaltyPercent: 5,
    version: 1,
    updatedAt: '2026-10-15T12:00:00.000Z',
  },
  {
    id: 'sage-nomad-009',
    tokenId: '#0009',
    slug: 'sage-nomad-009',
    title: 'Sage Nomad #009',
    collectionName: 'Nomad Signals',
    category: 'Colecionáveis',
    network: 'Ethereum',
    priceEth: '1.69',
    editionType: '1/10',
    availableEditions: 10,
    totalEditions: 10,
    imageUrl: '/mock-assets/nfts/ape-ivory.png',
    galleryUrls: ['/mock-assets/nfts/ape-ivory.png'],
    rating: 4.8,
    reviewsCount: 68,
    description: 'Uma peça colecionável da série Nomad Signals.',
    longDescription:
      'Sage Nomad #009 combina formas orgânicas e tons serenos em uma edição limitada.',
    attributes: ['Sage', 'Nomad', 'Edição limitada'],
    contractAddress: '0x0000000000000000000000000000000000000009',
    creatorRoyaltyPercent: 5,
    version: 1,
    updatedAt: '2026-10-14T12:00:00.000Z',
  },
  {
    id: 'neon-vessel-552',
    tokenId: '#0552',
    slug: 'neon-vessel-552',
    title: 'Neon Vessel #552',
    collectionName: 'Neon Vessels',
    category: 'Arte 3D',
    network: 'Polygon',
    priceEth: '1.99',
    originalPriceEth: '2.29',
    editionType: '1/10',
    availableEditions: 10,
    totalEditions: 10,
    imageUrl: '/mock-assets/nfts/ape-cosmic.png',
    galleryUrls: ['/mock-assets/nfts/ape-cosmic.png'],
    isRare: true,
    isFeatured: true,
    rating: 4.9,
    reviewsCount: 92,
    description: 'Escultura digital neon em edição rara.',
    longDescription:
      'Neon Vessel #552 é uma escultura tridimensional rara com cores vibrantes e acabamento luminoso.',
    attributes: ['Neon', '3D', 'Raro'],
    contractAddress: '0x0000000000000000000000000000000000000552',
    creatorRoyaltyPercent: 7.5,
    version: 1,
    updatedAt: '2026-10-13T12:00:00.000Z',
  },
  {
    id: 'cosmic-bloom-118',
    tokenId: '#0118',
    slug: 'cosmic-bloom-118',
    title: 'Cosmic Bloom #118',
    collectionName: 'Cosmic Garden',
    category: 'Generativa',
    network: 'Polygon',
    priceEth: '1.29',
    editionType: '1/50',
    availableEditions: 50,
    totalEditions: 50,
    imageUrl: '/mock-assets/nfts/ape-cosmic.png',
    galleryUrls: ['/mock-assets/nfts/ape-cosmic.png'],
    isLaunch: true,
    rating: 4.7,
    reviewsCount: 41,
    description: 'Arte generativa inspirada em jardins cósmicos.',
    longDescription:
      'Cosmic Bloom #118 é uma composição generativa que explora formas e cores do espaço.',
    attributes: ['Cosmic', 'Floral', 'Generativa'],
    contractAddress: '0x0000000000000000000000000000000000000118',
    creatorRoyaltyPercent: 5,
    version: 1,
    updatedAt: '2026-10-12T12:00:00.000Z',
  },
  {
    id: 'violet-nomad-314',
    tokenId: '#0314',
    slug: 'violet-nomad-314',
    title: 'Violet Nomad #314',
    collectionName: 'Nomad Frequencies',
    category: 'Música',
    network: 'Ethereum',
    priceEth: '1.39',
    editionType: '1/1',
    availableEditions: 8,
    totalEditions: 8,
    imageUrl: '/mock-assets/nfts/ape-golden.png',
    galleryUrls: ['/mock-assets/nfts/ape-golden.png'],
    rating: 4.6,
    reviewsCount: 33,
    description: 'Uma faixa visual colecionável da série Nomad Frequencies.',
    longDescription:
      'Violet Nomad #314 é uma obra audiovisual única disponível em uma série de oito unidades.',
    attributes: ['Violet', 'Música', 'Nomad'],
    contractAddress: '0x0000000000000000000000000000000000000314',
    creatorRoyaltyPercent: 5,
    version: 1,
    updatedAt: '2026-10-11T12:00:00.000Z',
  },
  {
    id: 'ivory-baron-088',
    tokenId: '#0088',
    slug: 'ivory-baron-088',
    title: 'Ivory Baron #088',
    collectionName: 'Ivory Portraits',
    category: 'Fotografia',
    network: 'Ethereum',
    priceEth: '1.79',
    editionType: '1/10',
    availableEditions: 12,
    totalEditions: 12,
    imageUrl: '/mock-assets/nfts/ape-ivory.png',
    galleryUrls: ['/mock-assets/nfts/ape-ivory.png'],
    isRare: true,
    isFeatured: true,
    rating: 4.9,
    reviewsCount: 106,
    description: 'Retrato fotográfico raro em edição limitada.',
    longDescription:
      'Ivory Baron #088 integra a coleção Ivory Portraits, com uma edição fotográfica numerada.',
    attributes: ['Ivory', 'Retrato', 'Raro'],
    contractAddress: '0x0000000000000000000000000000000000000088',
    creatorRoyaltyPercent: 6,
    version: 1,
    updatedAt: '2026-10-10T12:00:00.000Z',
  },
  {
    id: 'golden-beat-207',
    tokenId: '#0207',
    slug: 'golden-beat-207',
    title: 'Golden Beat #207',
    collectionName: 'Golden Frequencies',
    category: 'Música',
    network: 'Solana',
    priceEth: '0.99',
    editionType: '1/50',
    availableEditions: 50,
    totalEditions: 50,
    imageUrl: '/mock-assets/nfts/ape-golden.png',
    galleryUrls: ['/mock-assets/nfts/ape-golden.png'],
    rating: 4.5,
    reviewsCount: 57,
    description: 'Colecionável musical da série Golden Frequencies.',
    longDescription:
      'Golden Beat #207 celebra ritmos digitais em uma edição colecionável.',
    attributes: ['Golden', 'Beat', 'Música'],
    contractAddress: 'SoKurioGoldenBeat207',
    creatorRoyaltyPercent: 5,
    version: 1,
    updatedAt: '2026-10-09T12:00:00.000Z',
  },
  {
    id: 'golden-frequency-071',
    tokenId: '#0071',
    slug: 'golden-frequency-071',
    title: 'Golden Frequency #071',
    collectionName: 'Golden Arcade',
    category: 'Jogos',
    network: 'Polygon',
    priceEth: '0.59',
    editionType: 'ABERTA',
    availableEditions: 100,
    totalEditions: 100,
    imageUrl: '/mock-assets/nfts/ape-golden.png',
    galleryUrls: ['/mock-assets/nfts/ape-golden.png'],
    rating: 4.4,
    reviewsCount: 28,
    description: 'Item digital da coleção Golden Arcade.',
    longDescription:
      'Golden Frequency #071 é um item colecionável aberto inspirado em jogos arcade.',
    attributes: ['Arcade', 'Golden', 'Jogo'],
    contractAddress: '0x0000000000000000000000000000000000000071',
    creatorRoyaltyPercent: 4,
    version: 1,
    updatedAt: '2026-10-08T12:00:00.000Z',
  },
  {
    id: 'golden-signal-160',
    tokenId: '#0160',
    slug: 'golden-signal-160',
    title: 'Golden Signal #160',
    collectionName: 'Golden Signals',
    category: 'Utilidade',
    network: 'Solana',
    priceEth: '0.39',
    editionType: 'ABERTA',
    availableEditions: 100,
    totalEditions: 100,
    imageUrl: '/mock-assets/nfts/ape-emerald.png',
    galleryUrls: ['/mock-assets/nfts/ape-emerald.png'],
    rating: 4.3,
    reviewsCount: 19,
    description: 'Passe digital com utilidade para a comunidade.',
    longDescription:
      'Golden Signal #160 oferece acesso e benefícios digitais para colecionadores.',
    attributes: ['Acesso', 'Comunidade', 'Utilidade'],
    contractAddress: 'SoKurioGoldenSignal160',
    creatorRoyaltyPercent: 3,
    version: 1,
    updatedAt: '2026-10-07T12:00:00.000Z',
  },
  {
    id: 'kurio-pass-006',
    tokenId: '#0006',
    slug: 'kurio-pass-006',
    title: 'Kurio Pass #006',
    collectionName: 'Kurio Membership',
    category: 'Assinaturas',
    network: 'Polygon',
    priceEth: '0.79',
    editionType: '1/10',
    availableEditions: 10,
    totalEditions: 10,
    imageUrl: '/mock-assets/nfts/ape-emerald.png',
    galleryUrls: ['/mock-assets/nfts/ape-emerald.png'],
    rating: 4.8,
    reviewsCount: 47,
    description: 'Passe de assinatura para a comunidade KURIO.',
    longDescription:
      'Kurio Pass #006 oferece benefícios para membros da comunidade KURIO.',
    attributes: ['Membro', 'Passe', 'Assinatura'],
    contractAddress: '0x0000000000000000000000000000000000000006',
    creatorRoyaltyPercent: 4,
    version: 1,
    updatedAt: '2026-10-06T12:00:00.000Z',
  },
  {
    id: 'emerald-glyph-024',
    tokenId: '#0024',
    slug: 'emerald-glyph-024',
    title: 'Emerald Glyph #024',
    collectionName: 'Emerald Studies',
    category: 'Arte digital',
    network: 'Ethereum',
    priceEth: '0.89',
    editionType: '1/50',
    availableEditions: 50,
    totalEditions: 50,
    imageUrl: '/mock-assets/nfts/ape-emerald.png',
    galleryUrls: ['/mock-assets/nfts/ape-emerald.png'],
    rating: 4.5,
    reviewsCount: 22,
    description: 'Estudo digital em tons de esmeralda.',
    longDescription:
      'Emerald Glyph #024 é um estudo de formas digitais em uma paleta verde profunda.',
    attributes: ['Emerald', 'Glyph', 'Digital'],
    contractAddress: '0x0000000000000000000000000000000000000024',
    creatorRoyaltyPercent: 5,
    version: 1,
    updatedAt: '2026-10-05T12:00:00.000Z',
  },
  {
    id: 'cosmic-relay-031',
    tokenId: '#0031',
    slug: 'cosmic-relay-031',
    title: 'Cosmic Relay #031',
    collectionName: 'Cosmic Vessels',
    category: 'Arte 3D',
    network: 'Polygon',
    priceEth: '2.19',
    editionType: '1/10',
    availableEditions: 10,
    totalEditions: 10,
    imageUrl: '/mock-assets/nfts/ape-cosmic.png',
    galleryUrls: ['/mock-assets/nfts/ape-cosmic.png'],
    isLaunch: true,
    rating: 4.7,
    reviewsCount: 36,
    description: 'Objeto 3D colecionável da coleção Cosmic Vessels.',
    longDescription:
      'Cosmic Relay #031 explora volumes e luz em uma escultura tridimensional.',
    attributes: ['Cosmic', '3D', 'Relay'],
    contractAddress: '0x0000000000000000000000000000000000000031',
    creatorRoyaltyPercent: 6,
    version: 1,
    updatedAt: '2026-10-04T12:00:00.000Z',
  },
  {
    id: 'ivory-lens-102',
    tokenId: '#0102',
    slug: 'ivory-lens-102',
    title: 'Ivory Lens #102',
    collectionName: 'Ivory Portraits',
    category: 'Fotografia',
    network: 'Polygon',
    priceEth: '0.69',
    editionType: '1/50',
    availableEditions: 50,
    totalEditions: 50,
    imageUrl: '/mock-assets/nfts/ape-ivory.png',
    galleryUrls: ['/mock-assets/nfts/ape-ivory.png'],
    rating: 4.4,
    reviewsCount: 18,
    description: 'Fotografia digital em uma composição minimalista.',
    longDescription: 'Ivory Lens #102 apresenta uma composição fotográfica delicada.',
    attributes: ['Fotografia', 'Ivory', 'Minimal'],
    contractAddress: '0x0000000000000000000000000000000000000102',
    creatorRoyaltyPercent: 5,
    version: 1,
    updatedAt: '2026-10-03T12:00:00.000Z',
  },
  {
    id: 'nomad-melody-233',
    tokenId: '#0233',
    slug: 'nomad-melody-233',
    title: 'Nomad Melody #233',
    collectionName: 'Nomad Frequencies',
    category: 'Música',
    network: 'Solana',
    priceEth: '0.49',
    editionType: '1/50',
    availableEditions: 50,
    totalEditions: 50,
    imageUrl: '/mock-assets/nfts/ape-golden.png',
    galleryUrls: ['/mock-assets/nfts/ape-golden.png'],
    rating: 4.3,
    reviewsCount: 16,
    description: 'Peça audiovisual colecionável da série Nomad.',
    longDescription: 'Nomad Melody #233 reúne som e imagem em uma edição numerada.',
    attributes: ['Música', 'Nomad', 'Melody'],
    contractAddress: 'SoKurioNomadMelody233',
    creatorRoyaltyPercent: 5,
    version: 1,
    updatedAt: '2026-10-02T12:00:00.000Z',
  },
  {
    id: 'arcade-orbit-405',
    tokenId: '#0405',
    slug: 'arcade-orbit-405',
    title: 'Arcade Orbit #405',
    collectionName: 'Golden Arcade',
    category: 'Jogos',
    network: 'Ethereum',
    priceEth: '0.29',
    editionType: 'ABERTA',
    availableEditions: 100,
    totalEditions: 100,
    imageUrl: '/mock-assets/nfts/ape-cosmic.png',
    galleryUrls: ['/mock-assets/nfts/ape-cosmic.png'],
    rating: 4.2,
    reviewsCount: 12,
    description: 'Colecionável de jogo inspirado em arcades clássicos.',
    longDescription: 'Arcade Orbit #405 é um item aberto para fãs de jogos digitais.',
    attributes: ['Jogos', 'Arcade', 'Orbit'],
    contractAddress: '0x0000000000000000000000000000000000000405',
    creatorRoyaltyPercent: 4,
    version: 1,
    updatedAt: '2026-10-01T12:00:00.000Z',
  },
  {
    id: 'kurio-club-011',
    tokenId: '#0011',
    slug: 'kurio-club-011',
    title: 'Kurio Club #011',
    collectionName: 'Kurio Membership',
    category: 'Assinaturas',
    network: 'Ethereum',
    priceEth: '1.09',
    editionType: '1/10',
    availableEditions: 10,
    totalEditions: 10,
    imageUrl: '/mock-assets/nfts/ape-emerald.png',
    galleryUrls: ['/mock-assets/nfts/ape-emerald.png'],
    rating: 4.6,
    reviewsCount: 31,
    description: 'Passe de membro com benefícios para colecionadores.',
    longDescription: 'Kurio Club #011 oferece acesso a experiências exclusivas da comunidade.',
    attributes: ['Clube', 'Acesso', 'Assinatura'],
    contractAddress: '0x0000000000000000000000000000000000000011',
    creatorRoyaltyPercent: 4,
    version: 1,
    updatedAt: '2026-09-30T12:00:00.000Z',
  },
  {
    id: 'signal-key-052',
    tokenId: '#0052',
    slug: 'signal-key-052',
    title: 'Signal Key #052',
    collectionName: 'Golden Signals',
    category: 'Utilidade',
    network: 'Polygon',
    priceEth: '0.35',
    editionType: 'ABERTA',
    availableEditions: 100,
    totalEditions: 100,
    imageUrl: '/mock-assets/nfts/ape-golden.png',
    galleryUrls: ['/mock-assets/nfts/ape-golden.png'],
    rating: 4.1,
    reviewsCount: 9,
    description: 'Chave digital de acesso à comunidade.',
    longDescription: 'Signal Key #052 conecta colecionadores a recursos digitais.',
    attributes: ['Acesso', 'Utilidade', 'Signal'],
    contractAddress: 'SoKurioSignalKey052',
    creatorRoyaltyPercent: 3,
    version: 1,
    updatedAt: '2026-09-29T12:00:00.000Z',
  },
  {
    id: 'emerald-oracle-063',
    tokenId: '#0063',
    slug: 'emerald-oracle-063',
    title: 'Emerald Oracle #063',
    collectionName: 'Emerald Studies',
    category: 'Generativa',
    network: 'Solana',
    priceEth: '0.75',
    editionType: '1/50',
    availableEditions: 50,
    totalEditions: 50,
    imageUrl: '/mock-assets/nfts/ape-emerald.png',
    galleryUrls: ['/mock-assets/nfts/ape-emerald.png'],
    isLaunch: true,
    rating: 4.7,
    reviewsCount: 25,
    description: 'Obra generativa em tons verdes e formas orgânicas.',
    longDescription: 'Emerald Oracle #063 combina algoritmos generativos e arte digital.',
    attributes: ['Generativa', 'Emerald', 'Oracle'],
    contractAddress: 'SoKurioEmeraldOracle063',
    creatorRoyaltyPercent: 5,
    version: 1,
    updatedAt: '2026-09-28T12:00:00.000Z',
  },
]

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

async function derivePasswordHash(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    256,
  )
  return bytesToBase64(new Uint8Array(bits))
}

/** PBKDF2-SHA256 com salt aleatório por senha; nunca armazena a senha em claro. */
async function hashMockPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await derivePasswordHash(password, salt, PASSWORD_HASH_ITERATIONS)
  return `pbkdf2-sha256$${PASSWORD_HASH_ITERATIONS}$${bytesToBase64(salt)}$${hash}`
}

async function verifyMockPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const [scheme, iterationsText, saltText, expectedHash] = storedHash.split('$')
  const iterations = Number(iterationsText)
  if (
    scheme !== 'pbkdf2-sha256' ||
    !Number.isSafeInteger(iterations) ||
    !saltText ||
    !expectedHash
  ) {
    return false
  }
  const actualHash = await derivePasswordHash(
    password,
    base64ToBytes(saltText),
    iterations,
  )
  // Comparação em tempo constante para não vazar o prefixo correto do hash.
  let difference = actualHash.length ^ expectedHash.length
  for (let index = 0; index < expectedHash.length; index += 1) {
    difference |= actualHash.charCodeAt(index) ^ expectedHash.charCodeAt(index)
  }
  return difference === 0
}

function fnv1a(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function createAuthFixtures(): StoredAuthState {
  const makeUser = (
    id: string,
    displayName: string,
    username: string,
    email: string,
    ensName: string,
    walletNickname: string,
    primaryAddress: string,
    reserveAddress: string,
    reserveProvider: WalletDto['walletType'],
    passwordHash: string,
  ): StoredMockUser => {
    const profile: UserProfileDto = {
      id,
      displayName,
      username,
      email,
      ensName,
      ensDomain: '.eth',
      walletNickname,
      avatarUrl: null,
    }
    const walletDetails = {
      userId: id,
      profileName: username,
      referralCode: `KURIO-${username.toUpperCase()}`,
      email,
      ensName,
      ensDomain: '.eth',
    }
    return {
      profile,
      passwordHash,
      wallets: [
        {
          id: `${id}-wallet-primary`,
          ...walletDetails,
          isPrimary: true,
          label: 'Principal',
          displayName: 'Carteira Principal',
          walletNickname,
          network: 'Ethereum',
          address: primaryAddress,
          walletType: 'MetaMask',
        },
        {
          id: `${id}-wallet-reserve`,
          ...walletDetails,
          isPrimary: false,
          label: 'Reserva',
          displayName: 'Carteira Reserva',
          walletNickname,
          network: 'Polygon',
          profileName: ensName,
          address: reserveAddress,
          secondaryAddressOrEns: `${ensName}.eth`,
          walletType: reserveProvider,
        },
      ],
    }
  }
  return {
    users: [
      makeUser(
        'user-nova-sato',
        'Nova Sato',
        'novasato',
        'contato@email.com',
        'nova.kurio',
        'Kurio Vault',
        '0xA91F...E82C',
        '0xC3D2...41AF',
        'Coinbase Wallet',
        FIXTURE_PASSWORD_HASHES.nova,
      ),
      makeUser(
        'user-kael-vance',
        'Kael Vance',
        'kaelvance',
        'colecionador@kurio.io',
        'kael.kurio',
        'Vance Cold',
        '0xB82A...F91D',
        '0xD4E5...52BA',
        'Coinbase Wallet',
        FIXTURE_PASSWORD_HASHES.kael,
      ),
    ],
    sessions: {},
  }
}

function parseStoredJson(serialized: string): unknown {
  try {
    return JSON.parse(serialized)
  } catch {
    return undefined
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasStringFields(value: Record<string, unknown>, fields: string[]): boolean {
  return fields.every((field) => typeof value[field] === 'string')
}

function isStoredEth(value: unknown): value is string {
  return typeof value === 'string' && /^\d+(?:\.\d{1,18})?$/.test(value)
}

function isStoredWallet(value: unknown): value is WalletDto {
  return isRecord(value) && hasStringFields(value, [
    'id', 'userId', 'label', 'displayName', 'walletNickname', 'network',
    'profileName', 'address', 'walletType', 'referralCode', 'email', 'ensName', 'ensDomain',
  ]) && typeof value.isPrimary === 'boolean'
}

function isStoredProfile(value: unknown): value is UserProfileDto {
  return isRecord(value) && hasStringFields(value, [
    'id', 'displayName', 'username', 'email', 'ensName', 'ensDomain', 'walletNickname',
  ]) && (value.avatarUrl === null || typeof value.avatarUrl === 'string')
}

function isStoredAuthState(value: unknown): value is StoredAuthState {
  return (
    isRecord(value) &&
    Array.isArray(value.users) &&
    value.users.every((user: unknown) =>
      isRecord(user) && isStoredProfile(user.profile) &&
      typeof user.passwordHash === 'string' &&
      Array.isArray(user.wallets) && user.wallets.every(isStoredWallet),
    ) &&
    isRecord(value.sessions) &&
    Object.values(value.sessions).every((session: unknown) =>
      isRecord(session) && typeof session.userId === 'string' &&
      typeof session.expiresAt === 'string' && Number.isFinite(Date.parse(session.expiresAt)),
    )
  )
}

// Lê sempre do localStorage: abas diferentes enxergam o mesmo banco simulado.
// Dados corrompidos são descartados e a tabela volta às fixtures.
function getAuthState(): StoredAuthState {
  const serialized = getStorage()?.getItem(AUTH_STORAGE_KEY)
  const parsed = serialized ? parseStoredJson(serialized) : undefined
  if (isStoredAuthState(parsed)) return parsed
  const fixtures = createAuthFixtures()
  saveAuthState(fixtures)
  return fixtures
}

function saveAuthState(state: StoredAuthState): void {
  getStorage()?.setItem(AUTH_STORAGE_KEY, JSON.stringify(state))
}

function createMockSession(user: StoredMockUser): {
  session: AuthSessionDto
  wallets: WalletDto[]
} {
  const auth = getAuthState()
  const token = `kurio-session-${crypto.randomUUID()}`
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString()
  auth.sessions[token] = { userId: user.profile.id, expiresAt }
  saveAuthState(auth)
  return {
    session: { token, expiresAt, user: user.profile },
    wallets: structuredClone(user.wallets),
  }
}

export async function authenticateMockUser(
  email: string,
  password: string,
): Promise<{ session: AuthSessionDto; wallets: WalletDto[] } | null> {
  const normalizedEmail = email.trim().toLocaleLowerCase()
  const user = getAuthState().users.find(
    (entry) => entry.profile.email.toLocaleLowerCase() === normalizedEmail,
  )
  if (!user || !(await verifyMockPassword(password, user.passwordHash))) {
    return null
  }
  return createMockSession(user)
}

export function findMockUserByEmailOrUsername(
  email: string,
  username: string,
): 'email' | 'username' | null {
  const normalizedEmail = email.trim().toLocaleLowerCase()
  const normalizedUsername = username.trim().toLocaleLowerCase()
  const duplicate = getAuthState().users.find(
    (user) =>
      user.profile.email.toLocaleLowerCase() === normalizedEmail ||
      user.profile.username.toLocaleLowerCase() === normalizedUsername,
  )
  if (!duplicate) return null
  return duplicate.profile.email.toLocaleLowerCase() === normalizedEmail
    ? 'email'
    : 'username'
}

export async function registerMockUser(input: {
  username: string
  email: string
  password: string
}): Promise<{ session: AuthSessionDto; wallets: WalletDto[] }> {
  const passwordHash = await hashMockPassword(input.password)
  const auth = getAuthState()
  const user: StoredMockUser = {
    profile: {
      id: `user-${crypto.randomUUID()}`,
      displayName: input.username,
      username: input.username,
      email: input.email,
      ensName: input.username.toLocaleLowerCase(),
      ensDomain: '.eth',
      walletNickname: 'Minha carteira',
      avatarUrl: null,
    },
    passwordHash,
    wallets: [],
  }
  auth.users.push(user)
  saveAuthState(auth)
  return createMockSession(user)
}

export function getMockSession(
  token: string,
): { session: AuthSessionDto; wallets: WalletDto[] } | null {
  const auth = getAuthState()
  const storedSession = auth.sessions[token]
  if (!storedSession || new Date(storedSession.expiresAt).getTime() <= Date.now()) {
    return null
  }
  const user = auth.users.find(
    (entry) => entry.profile.id === storedSession.userId,
  )
  if (!user) return null
  return {
    session: {
      token,
      expiresAt: storedSession.expiresAt,
      user: user.profile,
    },
    wallets: structuredClone(user.wallets),
  }
}

export function revokeMockSession(token: string): void {
  const auth = getAuthState()
  delete auth.sessions[token]
  saveAuthState(auth)
}

export function getMockProfile(userId: string): UserProfileDto | null {
  const user = getAuthState().users.find((entry) => entry.profile.id === userId)
  return user ? structuredClone(user.profile) : null
}

export function updateMockProfile(
  userId: string,
  input: UpdateProfileRequestDto,
): UserProfileDto | null {
  const auth = getAuthState()
  const user = auth.users.find((entry) => entry.profile.id === userId)
  if (!user) return null

  const normalizedEmail = input.email.trim().toLocaleLowerCase()
  const normalizedUsername = input.username.trim().toLocaleLowerCase()
  const emailTaken = auth.users.some(
    (entry) =>
      entry.profile.id !== userId &&
      entry.profile.email.toLocaleLowerCase() === normalizedEmail,
  )
  if (emailTaken) throw new RangeError('EMAIL_EXISTS')
  const usernameTaken = auth.users.some(
    (entry) =>
      entry.profile.id !== userId &&
      entry.profile.username.toLocaleLowerCase() === normalizedUsername,
  )
  if (usernameTaken) throw new RangeError('USERNAME_EXISTS')

  user.profile = {
    ...user.profile,
    ...input,
    displayName: input.displayName.trim(),
    username: input.username.trim(),
    email: input.email.trim(),
    ensName: input.ensName.trim(),
    ensDomain: input.ensDomain,
    walletNickname: input.walletNickname.trim(),
  }
  user.wallets = user.wallets.map((wallet) => ({
    ...wallet,
    displayName: user.profile.displayName,
    walletNickname: user.profile.walletNickname,
    email: user.profile.email,
    ensName: user.profile.ensName,
    ensDomain: user.profile.ensDomain,
  }))
  saveAuthState(auth)
  return structuredClone(user.profile)
}

export async function updateMockPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<boolean> {
  const current = getAuthState().users.find((entry) => entry.profile.id === userId)
  if (!current || !(await verifyMockPassword(currentPassword, current.passwordHash))) {
    return false
  }
  const newHash = await hashMockPassword(newPassword)
  const auth = getAuthState()
  const user = auth.users.find((entry) => entry.profile.id === userId)
  if (!user) return false
  user.passwordHash = newHash
  saveAuthState(auth)
  return true
}

export function getMockWallets(userId: string): WalletDto[] {
  const user = getAuthState().users.find((entry) => entry.profile.id === userId)
  return user ? structuredClone(user.wallets) : []
}

function updateWalletOwnership(user: StoredMockUser): void {
  user.wallets = user.wallets.map((wallet) => ({
    ...wallet,
    label: wallet.isPrimary ? 'Principal' : 'Reserva',
  }))
}

export function createMockWallet(
  userId: string,
  input: WalletInputDto,
): WalletDto | null {
  const auth = getAuthState()
  const user = auth.users.find((entry) => entry.profile.id === userId)
  if (!user) return null

  const isPrimary = input.isPrimary || user.wallets.length === 0
  const wallet: WalletDto = {
    ...input,
    id: `wallet-${crypto.randomUUID()}`,
    userId,
    isPrimary,
    label: isPrimary ? 'Principal' : 'Reserva',
  }
  if (isPrimary) {
    user.wallets = user.wallets.map((entry) => ({
      ...entry,
      isPrimary: false,
      label: 'Reserva',
    }))
  }
  user.wallets.push(wallet)
  updateWalletOwnership(user)
  if (wallet.isPrimary) {
    user.wallets = user.wallets.map((entry) =>
      entry.sameAsPrimary
        ? {
            ...entry,
            address: wallet.address,
            network: wallet.network,
            walletType: wallet.walletType,
            ensName: wallet.ensName,
            ensDomain: wallet.ensDomain,
          }
        : entry,
    )
  }
  saveAuthState(auth)
  return structuredClone(wallet)
}

export function updateMockWallet(
  userId: string,
  walletId: string,
  input: WalletInputDto,
): WalletDto | null {
  const auth = getAuthState()
  const user = auth.users.find((entry) => entry.profile.id === userId)
  const wallet = user?.wallets.find((entry) => entry.id === walletId)
  if (!user || !wallet) return null

  const updated: WalletDto = {
    ...wallet,
    ...input,
    id: wallet.id,
    userId,
    isPrimary: input.isPrimary,
    label: input.isPrimary ? 'Principal' : 'Reserva',
  }
  user.wallets = user.wallets.map((entry) => {
    if (entry.id === walletId) return updated
    return input.isPrimary
      ? { ...entry, isPrimary: false, label: 'Reserva' }
      : entry
  })
  if (!user.wallets.some((entry) => entry.isPrimary) && user.wallets.length > 0) {
    user.wallets[0].isPrimary = true
  }
  updateWalletOwnership(user)
  const primaryWallet = user.wallets.find((entry) => entry.isPrimary)
  if (updated.isPrimary && primaryWallet) {
    user.wallets = user.wallets.map((entry) =>
      entry.sameAsPrimary
        ? {
            ...entry,
            address: primaryWallet.address,
            network: primaryWallet.network,
            walletType: primaryWallet.walletType,
            ensName: primaryWallet.ensName,
            ensDomain: primaryWallet.ensDomain,
          }
        : entry,
    )
  }
  saveAuthState(auth)
  const savedWallet = user.wallets.find((entry) => entry.id === walletId)
  return savedWallet ? structuredClone(savedWallet) : null
}

export function deleteMockWallet(userId: string, walletId: string): boolean {
  const auth = getAuthState()
  const user = auth.users.find((entry) => entry.profile.id === userId)
  if (!user) return false
  const deletedWallet = user.wallets.find((entry) => entry.id === walletId)
  if (!deletedWallet) return false
  user.wallets = user.wallets.filter((entry) => entry.id !== walletId)
  if (deletedWallet.isPrimary && user.wallets.length > 0) {
    user.wallets[0].isPrimary = true
  }
  updateWalletOwnership(user)
  saveAuthState(auth)
  return true
}

export function mergeMockGuestCart(guestId: string, userId: string): void {
  const guestKey = `guest:${guestId}`
  const userKey = `user:${userId}`
  const cartTable = getMockCartTable()
  const guestCart = cartTable[guestKey] ?? { items: [], couponCode: null }
  const userCart = cartTable[userKey] ?? { items: [], couponCode: null }
  for (const guestItem of guestCart.items) {
    const nft = getMockNfts().find((item) => item.id === guestItem.nftId)
    if (!nft || nft.availableEditions <= 0) continue
    const existing = userCart.items.find((item) => item.nftId === guestItem.nftId)
    const quantity = Math.min(
      nft.availableEditions,
      (existing?.quantity ?? 0) + guestItem.quantity,
    )
    if (existing) {
      // Mantém o preço já visto pelo usuário: mudanças seguem exigindo confirmação explícita.
      existing.quantity = quantity
    } else {
      userCart.items.push({
        ...guestItem,
        itemId: `cart-${guestItem.nftId}`,
        quantity,
        addedPriceEth: nft.priceEth,
        addedVersion: nft.version,
      })
    }
  }
  cartTable[userKey] = userCart
  delete cartTable[guestKey]
  getStorage()?.setItem(CART_STORAGE_KEY, JSON.stringify(cartTable))
}

export function resetMockAuth(): void {
  getStorage()?.removeItem(AUTH_STORAGE_KEY)
}

function getStorage(): Storage | null {
  return typeof window === 'undefined' ? null : window.localStorage
}

function isStoredNftList(value: unknown): value is NftItem[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item: unknown) =>
        isRecord(item) && hasStringFields(item, [
          'id', 'tokenId', 'slug', 'title', 'collectionName', 'category', 'network',
          'editionType', 'imageUrl', 'description', 'longDescription', 'contractAddress', 'updatedAt',
        ]) && isStoredEth(item.priceEth) &&
        (item.originalPriceEth === undefined || isStoredEth(item.originalPriceEth)) &&
        Number.isSafeInteger(item.version) && Number.isSafeInteger(item.availableEditions) &&
        Number.isSafeInteger(item.totalEditions) && typeof item.rating === 'number' &&
        Number.isFinite(item.rating) && typeof item.reviewsCount === 'number' &&
        typeof item.creatorRoyaltyPercent === 'number' &&
        Array.isArray(item.galleryUrls) && item.galleryUrls.every((url: unknown) => typeof url === 'string') &&
        Array.isArray(item.attributes) && item.attributes.every((attribute: unknown) => typeof attribute === 'string'),
    )
  )
}

export function getMockNfts(): NftItem[] {
  const storage = getStorage()
  const serialized = storage?.getItem(STORAGE_KEY)
  const parsed = serialized ? parseStoredJson(serialized) : undefined
  if (!isStoredNftList(parsed)) {
    const seeded = structuredClone(originalFixtures)
    storage?.setItem(STORAGE_KEY, JSON.stringify(seeded))
    return seeded
  }

  const storedIds = new Set(parsed.map((item) => item.id))
  const addedFixtures = originalFixtures.filter((item) => !storedIds.has(item.id))
  if (addedFixtures.length === 0) return parsed
  const merged = [...parsed, ...structuredClone(addedFixtures)]
  storage?.setItem(STORAGE_KEY, JSON.stringify(merged))
  return merged
}

export function saveMockNfts(items: NftItem[]): void {
  getStorage()?.setItem(STORAGE_KEY, JSON.stringify(items))
}

/** Aplica uma mudança de preço/disponibilidade e incrementa a versão monotônica do NFT. */
export function updateMockNft(
  nftId: string,
  changes: { priceEth?: string; availableEditions?: number },
): NftItem | null {
  const items = getMockNfts()
  const current = items.find((item) => item.id === nftId)
  if (!current) return null
  const updated: NftItem = {
    ...current,
    ...(changes.priceEth !== undefined ? { priceEth: changes.priceEth } : {}),
    ...(changes.availableEditions !== undefined
      ? { availableEditions: changes.availableEditions }
      : {}),
    version: current.version + 1,
    updatedAt: new Date().toISOString(),
  }
  saveMockNfts(items.map((item) => (item.id === nftId ? updated : item)))
  return updated
}

function isFavoriteTable(value: unknown): value is Record<string, string[]> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every(
      (ids) =>
        Array.isArray(ids) &&
        ids.every((id): id is string => typeof id === 'string'),
    )
  )
}

function getMockFavoriteTable(): Record<string, string[]> {
  const serialized = getStorage()?.getItem(FAVORITES_STORAGE_KEY)
  const parsed = serialized ? parseStoredJson(serialized) : undefined
  return isFavoriteTable(parsed) ? parsed : {}
}

export function getMockFavorites(sessionId: string): string[] {
  return [...(getMockFavoriteTable()[sessionId] ?? [])]
}

export function saveMockFavorites(
  sessionId: string,
  nftIds: string[],
): string[] {
  const favorites = getMockFavoriteTable()
  favorites[sessionId] = [...new Set(nftIds)]
  getStorage()?.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites))
  return [...favorites[sessionId]]
}

export function resetMockFavorites(): void {
  getStorage()?.removeItem(FAVORITES_STORAGE_KEY)
}

function isCartTable(value: unknown): value is Record<string, StoredCart> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every(
      (cart: unknown) =>
        isRecord(cart) &&
        Array.isArray(cart.items) &&
        cart.items.every((item: unknown) =>
          isRecord(item) && hasStringFields(item, ['itemId', 'nftId', 'editionType']) &&
          typeof item.quantity === 'number' && Number.isSafeInteger(item.quantity) && item.quantity > 0 &&
          Number.isSafeInteger(item.addedVersion) && isStoredEth(item.addedPriceEth),
        ) &&
        (cart.couponCode === null || cart.couponCode === 'KURIO10' || cart.couponCode === 'LANCAMENTO1ETH'),
    )
  )
}

function getMockCartTable(): Record<string, StoredCart> {
  const serialized = getStorage()?.getItem(CART_STORAGE_KEY)
  const parsed = serialized ? parseStoredJson(serialized) : undefined
  return isCartTable(parsed) ? parsed : {}
}

function saveMockCart(sessionKey: string, cart: StoredCart): void {
  const carts = getMockCartTable()
  carts[sessionKey] = cart
  getStorage()?.setItem(CART_STORAGE_KEY, JSON.stringify(carts))
}

function isOrderTable(value: unknown): value is StoredMockOrder[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry: unknown) =>
        isRecord(entry) &&
        typeof entry.payloadFingerprint === 'string' &&
        isRecord(entry.order) &&
        hasStringFields(entry.order, ['id', 'userId', 'idempotencyKey', 'createdAt', 'updatedAt', 'transactionHash', 'network', 'walletProvider']) &&
        Number.isSafeInteger(entry.order.version) &&
        ['pending', 'confirmed', 'declined'].includes(String(entry.order.status)) &&
        isRecord(entry.order.collector) && typeof entry.order.collector.walletAddress === 'string' &&
        isRecord(entry.order.snapshot) &&
        isStoredEth(entry.order.snapshot.subtotalEth) &&
        isStoredEth(entry.order.snapshot.discountEth) &&
        isStoredEth(entry.order.snapshot.networkFeeEth) &&
        isStoredEth(entry.order.snapshot.totalEth) &&
        Array.isArray(entry.order.snapshot.items) &&
        entry.order.snapshot.items.every((item: unknown) =>
          isRecord(item) && hasStringFields(item, ['nftId', 'tokenId', 'title', 'imageUrl', 'editionType']) &&
          typeof item.quantity === 'number' && Number.isSafeInteger(item.quantity) && item.quantity > 0 &&
          isStoredEth(item.unitPriceEth) && isStoredEth(item.subtotalEth),
        ),
    )
  )
}

function getMockOrderTable(): StoredMockOrder[] {
  const serialized = getStorage()?.getItem(ORDERS_STORAGE_KEY)
  const parsed = serialized ? parseStoredJson(serialized) : undefined
  return isOrderTable(parsed) ? parsed : []
}

function saveMockOrders(orders: StoredMockOrder[]): void {
  getStorage()?.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders))
}

/** Forma canônica do payload do pedido: base da comparação de idempotência. */
function fingerprintOrderPayload(input: CreateOrderRequestDto): string {
  return JSON.stringify({
    quoteVersion: input.quoteVersion,
    walletProvider: input.walletProvider,
    network: input.network,
    collector: {
      displayName: input.collector.displayName,
      username: input.collector.username,
      network: input.collector.network,
      profileName: input.collector.profileName,
      walletAddress: input.collector.walletAddress,
      secondaryWalletOrEns: input.collector.secondaryWalletOrEns ?? '',
      walletType: input.collector.walletType,
      referralCode: input.collector.referralCode ?? '',
      email: input.collector.email,
      ensName: input.collector.ensName,
      ensDomain: input.collector.ensDomain,
      useAnotherWallet: input.collector.useAnotherWallet,
      notes: input.collector.notes ?? '',
    },
  })
}

function getQuoteVersion(sessionKey: string, cart: CartDto): string {
  const versionData = cart.items
    .map((item) =>
      [
        item.nftId,
        item.quantity,
        item.nftVersion,
        item.unitPriceEth,
        item.availableEditions,
      ].join(':'),
    )
    .sort()
    .join('|')
  const value = `${sessionKey}|${versionData}|${cart.couponCode ?? ''}|${cart.subtotalEth}|${cart.discountEth}|${cart.networkFeeEth}|${cart.totalEth}`
  return `quote-${fnv1a(value)}`
}

function getStoredCart(sessionKey: string): StoredCart {
  const carts = getMockCartTable()
  return carts[sessionKey] ?? { items: [], couponCode: null }
}

function calculateCartDiscount(
  couponCode: string | null,
  subtotalEth: string,
): { discountEth: string; discountLabel: string } {
  if (!couponCode) return { discountEth: '0.00', discountLabel: '' }
  if (couponCode === 'KURIO10') {
    return {
      discountEth: calculatePercentageDiscountEth(subtotalEth, 10),
      discountLabel: couponDefinitions.KURIO10.label,
    }
  }
  if (couponCode === 'LANCAMENTO1ETH') {
    return {
      discountEth: compareEth(subtotalEth, '1.00') < 0 ? subtotalEth : '1.00',
      discountLabel: couponDefinitions.LANCAMENTO1ETH.label,
    }
  }
  throw new TypeError(`Cupom salvo desconhecido: ${couponCode}`)
}

export function getMockCart(sessionKey: string): CartDto {
  const storedCart = getStoredCart(sessionKey)
  const nfts = getMockNfts()
  const items: CartItemDto[] = storedCart.items.map((storedItem) => {
    const nft = nfts.find((item) => item.id === storedItem.nftId)
    if (!nft) {
      throw new Error(`NFT ${storedItem.nftId} do carrinho não existe no catálogo.`)
    }
    const priceChanged = nft.priceEth !== storedItem.addedPriceEth
    const insufficientStock =
      nft.availableEditions === 0 ||
      storedItem.quantity > nft.availableEditions
    return {
      itemId: storedItem.itemId,
      nftId: nft.id,
      tokenId: nft.tokenId,
      title: nft.title,
      imageUrl: nft.imageUrl,
      editionType: storedItem.editionType,
      unitPriceEth: nft.priceEth,
      addedPriceEth: storedItem.addedPriceEth,
      quantity: storedItem.quantity,
      availableEditions: nft.availableEditions,
      lineTotalEth: multiplyEthByQuantity(nft.priceEth, storedItem.quantity),
      nftVersion: nft.version,
      ...(priceChanged
        ? { priceChanged: true, previousPriceEth: storedItem.addedPriceEth }
        : {}),
      ...(insufficientStock ? { insufficientStock: true } : {}),
    }
  })
  const subtotalEth = items.reduce(
    (subtotal, item) => addEth(subtotal, item.lineTotalEth),
    '0.00',
  )
  if (
    storedCart.couponCode === 'LANCAMENTO1ETH' &&
    compareEth(subtotalEth, '2.00') < 0
  ) {
    storedCart.couponCode = null
    saveMockCart(sessionKey, storedCart)
  }
  const { discountEth, discountLabel } = calculateCartDiscount(
    storedCart.couponCode,
    subtotalEth,
  )
  const networkFeeEth = items.length > 0 ? '0.016' : '0.00'

  const cart: CartDto = {
    items,
    couponCode: storedCart.couponCode,
    discountLabel,
    subtotalEth,
    discountEth,
    networkFeeEth,
    totalEth: addEth(subtractEth(subtotalEth, discountEth), networkFeeEth),
    quoteVersion: '',
    hasStaleItems: items.some(
      (item) => item.priceChanged || item.insufficientStock,
    ),
    updatedAt: new Date().toISOString(),
  }
  cart.quoteVersion = getQuoteVersion(sessionKey, cart)
  return cart
}

export function getMockCheckoutQuote(userId: string): CheckoutQuoteDto {
  const sessionKey = `user:${userId}`
  return getMockCart(sessionKey)
}

export function getMockOrderByIdempotencyKey(
  userId: string,
  idempotencyKey: string,
): { order: OrderDto; payloadFingerprint: string } | null {
  const found = getMockOrderTable().find(
    (entry) =>
      entry.order.userId === userId &&
      entry.order.idempotencyKey === idempotencyKey,
  )
  return found ? structuredClone(found) : null
}

export function getMockOrder(userId: string, orderId: string): OrderDto | null {
  const entry = getMockOrderTable().find(
    (item) => item.order.id === orderId && item.order.userId === userId,
  )
  return entry ? structuredClone(entry.order) : null
}

/** Dono de um pedido (ou null): permite responder 403 em vez de 404 a outro usuário. */
export function getMockOrderOwnerId(orderId: string): string | null {
  return (
    getMockOrderTable().find((entry) => entry.order.id === orderId)?.order
      .userId ?? null
  )
}

/** Pedidos pendentes de todos os usuários; usados para retomar a simulação após recarregar. */
export function listMockPendingOrders(): OrderDto[] {
  return getMockOrderTable()
    .filter((entry) => entry.order.status === 'pending')
    .map((entry) => structuredClone(entry.order))
}

export function getMockOrders(userId: string): OrderDto[] {
  return getMockOrderTable()
    .filter((entry) => entry.order.userId === userId)
    .map((entry) => structuredClone(entry.order))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}

export type CreateMockOrderResult =
  | { kind: 'created'; order: OrderDto }
  | { kind: 'replayed'; order: OrderDto }
  | { kind: 'idempotency-conflict' }
  | { kind: 'stale' }
  | { kind: 'unavailable'; message: string }
  | { kind: 'invalid-cart'; message: string }

export function createMockOrder(
  userId: string,
  idempotencyKey: string,
  input: CreateOrderRequestDto,
  status: OrderStatus,
): CreateMockOrderResult {
  const payloadFingerprint = fingerprintOrderPayload(input)
  const existing = getMockOrderByIdempotencyKey(userId, idempotencyKey)
  if (existing) {
    if (existing.payloadFingerprint !== payloadFingerprint) {
      return { kind: 'idempotency-conflict' }
    }
    return { kind: 'replayed', order: existing.order }
  }

  const quote = getMockCheckoutQuote(userId)
  if (quote.items.length === 0) return { kind: 'stale' }
  const soldOutItem = quote.items.find(
    (item) => item.availableEditions < item.quantity || item.availableEditions <= 0,
  )
  if (soldOutItem) {
    return {
      kind: 'unavailable',
      message: `A edição de ${soldOutItem.title} não está mais disponível na quantidade escolhida. Revise o carrinho.`,
    }
  }
  if (input.quoteVersion !== quote.quoteVersion || quote.hasStaleItems) {
    return { kind: 'stale' }
  }

  const profile = getMockProfile(userId)
  if (!profile) return { kind: 'invalid-cart', message: 'Perfil do colecionador não encontrado.' }

  const now = new Date().toISOString()
  const id = `order-${crypto.randomUUID()}`
  const order: OrderDto = {
    id,
    transactionHash: `0x${crypto.randomUUID().replaceAll('-', '').toUpperCase()}`,
    userId,
    status,
    createdAt: now,
    updatedAt: now,
    version: 1,
    idempotencyKey,
    walletProvider: input.walletProvider,
    network: input.network,
    collector: structuredClone(input.collector),
    snapshot: {
      items: quote.items.map((item) => ({
        nftId: item.nftId,
        tokenId: item.tokenId,
        title: item.title,
        imageUrl: item.imageUrl,
        editionType: item.editionType,
        quantity: item.quantity,
        unitPriceEth: item.unitPriceEth,
        subtotalEth: item.lineTotalEth,
      })),
      subtotalEth: quote.subtotalEth,
      discountEth: quote.discountEth,
      networkFeeEth: quote.networkFeeEth,
      totalEth: quote.totalEth,
      couponCode: quote.couponCode,
    },
    ...(status === 'declined' ? { failureReason: 'Pagamento recusado pela carteira.' } : {}),
  }

  if (status !== 'declined') {
    const nfts = getMockNfts()
    for (const item of quote.items) {
      const nft = nfts.find((entry) => entry.id === item.nftId)
      if (!nft || nft.availableEditions < item.quantity) {
        return { kind: 'invalid-cart', message: `Estoque insuficiente para ${item.title}.` }
      }
    }
    saveMockNfts(
      nfts.map((nft) => {
        const purchased = quote.items.find((item) => item.nftId === nft.id)
        return purchased
          ? {
              ...nft,
              availableEditions: nft.availableEditions - purchased.quantity,
              version: nft.version + 1,
              updatedAt: now,
            }
          : nft
      }),
    )
  }

  saveMockOrders([...getMockOrderTable(), { order, payloadFingerprint }])
  return { kind: 'created', order: structuredClone(order) }
}

export function transitionMockOrder(
  userId: string,
  orderId: string,
  status: Extract<OrderStatus, 'confirmed' | 'declined'>,
  failureReason?: string,
): OrderDto | null {
  const entries = getMockOrderTable()
  const entry = entries.find(
    (item) => item.order.id === orderId && item.order.userId === userId,
  )
  if (!entry || entry.order.status !== 'pending') return null
  if (status === 'declined') {
    const nfts = getMockNfts()
    const restoredNfts = nfts.map((nft) => {
      const purchased = entry.order.snapshot.items.find(
        (item) => item.nftId === nft.id,
      )
      return purchased
        ? {
            ...nft,
            availableEditions: nft.availableEditions + purchased.quantity,
            version: nft.version + 1,
            updatedAt: new Date().toISOString(),
          }
        : nft
    })
    saveMockNfts(restoredNfts)
  } else {
    const sessionKey = `user:${userId}`
    const cart = getStoredCart(sessionKey)
    cart.items = cart.items.flatMap((item) => {
      const purchased = entry.order.snapshot.items.find(
        (snapshotItem) => snapshotItem.nftId === item.nftId,
      )
      const quantity = item.quantity - (purchased?.quantity ?? 0)
      return quantity > 0 ? [{ ...item, quantity }] : []
    })
    if (cart.items.length === 0) cart.couponCode = null
    saveMockCart(sessionKey, cart)
  }
  entry.order = {
    ...entry.order,
    status,
    version: entry.order.version + 1,
    updatedAt: new Date().toISOString(),
    ...(status === 'declined'
      ? { failureReason: failureReason ?? 'Pagamento recusado pela carteira.' }
      : { failureReason: undefined }),
  }
  saveMockOrders(entries)
  return structuredClone(entry.order)
}

export function addMockCartItem(
  sessionKey: string,
  nftId: string,
  quantity: number,
  editionType?: NftItem['editionType'],
): CartDto {
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    throw new RangeError('A quantidade deve ser um inteiro positivo.')
  }
  const nft = getMockNfts().find((item) => item.id === nftId)
  if (!nft) throw new RangeError('NFT não encontrado.')
  if (editionType && editionType !== nft.editionType) throw new RangeError('EDITION_UNAVAILABLE')

  const cart = getStoredCart(sessionKey)
  const existingItem = cart.items.find((item) => item.nftId === nftId)
  const requestedTotal = (existingItem?.quantity ?? 0) + quantity
  if (requestedTotal > nft.availableEditions) {
    throw new RangeError('INSUFFICIENT_STOCK')
  }

  if (existingItem) {
    // O preço já visto não é atualizado aqui: só `acknowledgeMockCartChanges` confirma mudanças.
    existingItem.quantity = requestedTotal
    if (editionType) existingItem.editionType = editionType
  } else {
    cart.items.push({
      itemId: `cart-${nftId}`,
      nftId,
      quantity,
      editionType: editionType ?? nft.editionType,
      addedPriceEth: nft.priceEth,
      addedVersion: nft.version,
    })
  }
  saveMockCart(sessionKey, cart)
  return getMockCart(sessionKey)
}

export function updateMockCartItem(
  sessionKey: string,
  itemId: string,
  quantity: number,
): CartDto {
  if (!Number.isSafeInteger(quantity)) {
    throw new RangeError('A quantidade deve ser um inteiro seguro.')
  }
  const cart = getStoredCart(sessionKey)
  const index = cart.items.findIndex((item) => item.itemId === itemId)
  if (index < 0) throw new RangeError('CART_ITEM_NOT_FOUND')
  if (quantity <= 0) {
    cart.items.splice(index, 1)
  } else {
    const storedItem = cart.items[index]
    const nft = getMockNfts().find((item) => item.id === storedItem.nftId)
    if (!nft) throw new RangeError('NFT não encontrado.')
    if (quantity > nft.availableEditions) throw new RangeError('INSUFFICIENT_STOCK')
    storedItem.quantity = quantity
  }
  saveMockCart(sessionKey, cart)
  return getMockCart(sessionKey)
}

export function removeMockCartItem(
  sessionKey: string,
  itemId: string,
): CartDto {
  const cart = getStoredCart(sessionKey)
  cart.items = cart.items.filter((item) => item.itemId !== itemId)
  saveMockCart(sessionKey, cart)
  return getMockCart(sessionKey)
}

export function applyMockCartCoupon(
  sessionKey: string,
  code: string,
): CartDto {
  const normalizedCode = code.trim().toLocaleUpperCase()
  const cart = getStoredCart(sessionKey)
  if (normalizedCode === 'EXPIRADO20' || normalizedCode === 'EXPIRED') {
    throw new RangeError('COUPON_EXPIRED')
  }
  if (
    normalizedCode !== 'KURIO10' &&
    normalizedCode !== 'LANCAMENTO1ETH'
  ) {
    throw new RangeError('INVALID_COUPON')
  }
  const subtotalEth = getMockCart(sessionKey).subtotalEth
  if (
    normalizedCode === 'LANCAMENTO1ETH' &&
    compareEth(subtotalEth, '2.00') < 0
  ) {
    throw new RangeError('COUPON_MINIMUM_NOT_MET')
  }
  cart.couponCode = normalizedCode
  saveMockCart(sessionKey, cart)
  return getMockCart(sessionKey)
}

export function removeMockCartCoupon(sessionKey: string): CartDto {
  const cart = getStoredCart(sessionKey)
  cart.couponCode = null
  saveMockCart(sessionKey, cart)
  return getMockCart(sessionKey)
}

export function acknowledgeMockCartChanges(sessionKey: string): CartDto {
  const cart = getStoredCart(sessionKey)
  const nfts = getMockNfts()
  const removedUnavailableItems: string[] = []
  cart.items = cart.items.flatMap((item) => {
    const nft = nfts.find((entry) => entry.id === item.nftId)
    if (!nft) throw new Error(`NFT ${item.nftId} do carrinho não existe no catálogo.`)
    if (nft.availableEditions === 0) {
      removedUnavailableItems.push(nft.title)
      return []
    }
    item.quantity = Math.min(item.quantity, nft.availableEditions)
    item.addedPriceEth = nft.priceEth
    item.addedVersion = nft.version
    return [item]
  })
  saveMockCart(sessionKey, cart)
  return {
    ...getMockCart(sessionKey),
    ...(removedUnavailableItems.length > 0
      ? { acknowledgedUnavailableItems: removedUnavailableItems }
      : {}),
  }
}

export function resetMockDb(): NftItem[] {
  const restoredItems = structuredClone(originalFixtures)
  saveMockNfts(restoredItems)
  resetMockFavorites()
  resetMockAuth()
  getStorage()?.removeItem(CART_STORAGE_KEY)
  getStorage()?.removeItem(ORDERS_STORAGE_KEY)
  return restoredItems
}

export function getCatalogCounts(): {
  categories: Record<NftCollectionCategory, number>
  networks: Record<NftItem['network'], number>
} {
  const counts = {
    categories: {
      'Arte digital': 0,
      Fotografia: 0,
      Música: 0,
      'Arte 3D': 0,
      Colecionáveis: 0,
      Generativa: 0,
      Jogos: 0,
      Assinaturas: 0,
      Utilidade: 0,
    },
    networks: {
      Ethereum: 0,
      Polygon: 0,
      Solana: 0,
    },
  }

  for (const nft of getMockNfts()) {
    counts.categories[nft.category] += 1
    counts.networks[nft.network] += 1
  }

  return counts
}
