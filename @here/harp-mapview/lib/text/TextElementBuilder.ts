/*
 * Copyright (C) 2017-2020 HERE Europe B.V.
 * Licensed under Apache 2.0, see full license in LICENSE
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    AttributeMap,
    Env,
    getFeatureId,
    getPropertyValue,
    IndexedTechniqueParams,
    isTextTechnique,
    LineMarkerTechnique,
    MapEnv,
    PoiTechnique,
    TextTechnique
} from "@here/harp-datasource-protocol";
import {
    ContextualArabicConverter,
    TextLayoutStyle,
    TextRenderStyle
} from "@here/harp-text-canvas";
import { assert } from "@here/harp-utils";

import { Tile } from "../Tile";
import { TextElement } from "./TextElement";
import { DEFAULT_TEXT_DISTANCE_SCALE } from "./TextElementsRenderer";
import { TileTextStyleCache } from "./TileTextStyleCache";

/**
 * Creates {@link TextElement} objects from the decoded tile and list of materials specified. The
 * priorities of the {@link TextElement}s are updated to simplify label placement.
 *
 * @param tile - The {@link Tile} to create the testElements on.
 * @param decodedTile - The {@link @here/harp-datasource-protocol#DecodedTile}.
 * @param textFilter -: Optional filter. Should return true for any text technique that is
 *      applicable.
 */
export class TextElementBuilder {
    private m_priority?: number;
    private m_fadeNear?: number;
    private m_fadeFar?: number;
    private m_minZoomLevel?: number;
    private m_maxZoomLevel?: number;
    private m_distanceScale: number = DEFAULT_TEXT_DISTANCE_SCALE;
    private m_mayOverlap?: boolean;
    private m_reserveSpace?: boolean;
    private m_renderStyle?: TextRenderStyle;
    private m_layoutStype?: TextLayoutStyle;
    private m_technique?: (PoiTechnique | LineMarkerTechnique | TextTechnique) &
        IndexedTechniqueParams;

    private m_xOffset?: number;
    private m_yOffset?: number;

    constructor(
        private readonly env: MapEnv | Env,
        private readonly styleCache: TileTextStyleCache
    ) {}

    withTechnique(
        technique: (PoiTechnique | LineMarkerTechnique | TextTechnique) & IndexedTechniqueParams
    ): this {
        this.m_technique = technique;

        // Make sorting stable.
        this.m_priority =
            technique.priority !== undefined ? getPropertyValue(technique.priority, this.env) : 0;
        this.m_fadeNear =
            technique.fadeNear !== undefined
                ? getPropertyValue(technique.fadeNear, this.env)
                : technique.fadeNear;
        this.m_fadeFar =
            technique.fadeFar !== undefined
                ? getPropertyValue(technique.fadeFar, this.env)
                : technique.fadeFar;

        this.m_minZoomLevel = getPropertyValue(technique.minZoomLevel, this.env) ?? undefined;

        this.m_maxZoomLevel = getPropertyValue(technique.maxZoomLevel, this.env) ?? undefined;

        this.m_distanceScale = technique.distanceScale ?? DEFAULT_TEXT_DISTANCE_SCALE;
        if (isTextTechnique(technique)) {
            this.m_mayOverlap = technique.mayOverlap === true;
            this.m_reserveSpace = technique.reserveSpace !== false;
        } else {
            this.m_mayOverlap = technique.textMayOverlap === true;
            this.m_reserveSpace = technique.textReserveSpace !== false;
        }
        this.m_renderStyle = this.styleCache.getRenderStyle(technique);
        this.m_layoutStype = this.styleCache.getLayoutStyle(technique);
        this.m_xOffset = getPropertyValue(technique.xOffset, this.env);
        this.m_yOffset = getPropertyValue(technique.yOffset, this.env);

        return this;
    }

    build(
        text: string,
        points: THREE.Vector3 | THREE.Vector3[],
        tile: Tile,
        attributes?: AttributeMap,
        pathLengthSqr?: number
    ): TextElement {
        const featureId = getFeatureId(attributes);
        assert(this.m_technique !== undefined);
        assert(this.m_renderStyle !== undefined);
        assert(this.m_layoutStype !== undefined);

        const technique = this.m_technique!;
        const renderStyle = this.m_renderStyle!;
        const layoutStyle = this.m_layoutStype!;

        const textElement = new TextElement(
            ContextualArabicConverter.instance.convert(text),
            points,
            renderStyle,
            layoutStyle,
            this.m_priority,
            this.m_xOffset,
            this.m_yOffset,
            featureId,
            technique.style,
            this.m_fadeNear,
            this.m_fadeFar,
            tile.offset
        );
        textElement.minZoomLevel = this.m_minZoomLevel;
        textElement.maxZoomLevel = this.m_maxZoomLevel;
        textElement.distanceScale = this.m_distanceScale;
        textElement.mayOverlap = this.m_mayOverlap;
        textElement.reserveSpace = this.m_reserveSpace;
        textElement.kind = technique.kind;
        // Get the userData for text element picking.
        textElement.userData = attributes;
        textElement.textFadeTime = technique.textFadeTime;
        textElement.pathLengthSqr = pathLengthSqr;

        return textElement;
    }
}
