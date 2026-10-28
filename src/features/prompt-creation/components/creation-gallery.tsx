"use client";

import { useLayoutEffect } from "react";
import { GalleryPage, type GalleryPageProps } from "@/features/gallery/components/gallery-page";
import { GalleryFeed, type GalleryFeedProps } from "@/features/gallery/components/gallery-feed";
import { GallerySkeleton } from "@/features/gallery/components/gallery-skeleton";
import { useCreation } from "./creation-provider";
import { CreationHomeComposer, CreationPanel } from "./creation-panel";

type Props = Omit<GalleryPageProps, "creationComposer" | "chatPanel" | "chatOpen" | "onUseReference" | "activeReferenceId">;
export function CreationGallery(props: Props) {
  const { state, workflow, syncIdentity, guard } = useCreation();
  const identity = props.user?.id ?? null;
  useLayoutEffect(() => { syncIdentity(identity); }, [identity, syncIdentity]);
  return <GalleryPage {...props} creationComposer={<CreationHomeComposer />} chatPanel={state.expanded ? <CreationPanel /> : null} chatOpen={state.expanded}
    activeReferenceId={state.source?.promptId} onUseReference={reference => guard(() => { workflow.selectReference({ promptId: reference.id, title: reference.title, imageUrl: reference.image }); })} />;
}

/** These client adapters keep live creation controls around server-rendered public feed data. */
export function CreationGalleryFeed(props: Omit<GalleryFeedProps, "compact" | "onUseReference" | "activeReferenceId">) {
  const { state, workflow, guard } = useCreation();
  return <GalleryFeed {...props} compact={state.expanded} activeReferenceId={state.source?.promptId}
    onUseReference={reference => guard(() => { workflow.selectReference({ promptId: reference.id, title: reference.title, imageUrl: reference.image }); })} />;
}

export function CreationGallerySkeleton() {
  const { state } = useCreation();
  return <GallerySkeleton compact={state.expanded} />;
}
