import { useState } from 'react'
import { Image } from 'lucide-react'

interface NftGalleryProps {
  title: string
  imageUrl: string
  galleryUrls: string[]
}

export function NftGallery({
  title,
  imageUrl,
  galleryUrls,
}: NftGalleryProps) {
  const images = [...new Set([imageUrl, ...galleryUrls])]
  const [selectedImage, setSelectedImage] = useState(imageUrl)
  const hasThumbnails = images.length > 1

  // Mobile: miniaturas abaixo da imagem. Desktop (Figma): coluna vertical à esquerda.
  return (
    <section
      aria-label={`Galeria de ${title}`}
      className={`min-w-0 ${
        hasThumbnails
          ? 'lg:grid lg:grid-cols-[5.5rem_minmax(0,1fr)] lg:items-start lg:gap-4'
          : ''
      }`}
    >
      <div className="overflow-hidden rounded-2xl border border-kurio-border bg-kurio-surface lg:col-start-2 lg:row-start-1">
        <img
          src={selectedImage}
          alt={title}
          width={640}
          height={640}
          fetchPriority="high"
          className="aspect-square w-full object-cover"
        />
      </div>
      {hasThumbnails ? (
        <div className="mt-3 grid grid-cols-4 gap-2 sm:gap-3 lg:col-start-1 lg:row-start-1 lg:mt-0 lg:grid-cols-1 lg:content-start">
          {images.map((image, index) => (
            <button
              key={image}
              type="button"
              onClick={() => setSelectedImage(image)}
              aria-label={`Exibir imagem ${index + 1} de ${title}`}
              aria-pressed={selectedImage === image}
              className={`overflow-hidden rounded-lg border bg-kurio-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kurio-amber ${
                selectedImage === image
                  ? 'border-kurio-amber'
                  : 'border-kurio-border'
              }`}
            >
              <img
                src={image}
                alt=""
                width={88}
                height={88}
                loading="lazy"
                className="aspect-square w-full object-cover"
              />
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-3 flex items-center gap-2 text-xs text-kurio-text-muted">
          <Image size={15} aria-hidden="true" />
          Prévia da obra
        </p>
      )}
    </section>
  )
}
