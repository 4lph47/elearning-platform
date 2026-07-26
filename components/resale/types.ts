// Tipos leves para os tiles de revenda — não reaproveitam CourseCardData
// (moldado ao catálogo: rating/lessonCount/instructorName, Course.price)
// porque aqui o preço é o do revendedor, não o do curso, e um bundle não
// tem thumbnail/rating próprio.
export interface ResaleListingCardData {
  id: string;
  price: number;
  courseSlug: string;
  courseTitle: string;
  courseThumbnailUrl: string | null;
  courseCategory: string;
  courseLevel: string;
  sellerId: string;
  sellerName: string;
  // Opcional — só a página "Gerir revendas" usa isto para marcar as
  // desativadas na fila (ver ManageResaleSection.tsx). Ausente/irrelevante
  // nos outros sítios que constroem este tipo (aí só mostram ativas).
  active?: boolean;
}

export interface ResaleBundleCardData {
  id: string;
  name: string;
  coverImageUrl: string | null;
  price: number;
  listingCount: number;
  courseTitles: string[];
  sellerId: string;
  sellerName: string;
  // Opcional — só o marketplace usa isto para agrupar bundles por categoria
  // (categoria do primeiro curso incluído, um bundle não tem categoria
  // própria). Ausente nos outros sítios que constroem este tipo.
  category?: string;
}
