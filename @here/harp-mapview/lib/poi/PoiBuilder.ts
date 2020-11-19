/*
 * Copyright (C) 2017-2020 HERE Europe B.V.
 * Licensed under Apache 2.0, see full license in LICENSE
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    AttributeMap,
    Env,
    getPropertyValue,
    IndexedTechniqueParams,
    LineMarkerTechnique,
    MapEnv,
    PoiTechnique
} from "@here/harp-datasource-protocol";
import { assert, LoggerManager } from "@here/harp-utils";

import { ColorCache } from "../ColorCache";
import { TextElement } from "../text/TextElement";
import { TextElementBuilder } from "../text/TextElementBuilder";
import { TileTextStyleCache } from "../text/TileTextStyleCache";
import { Tile } from "../Tile";

const logger = LoggerManager.instance.create("PoiBuilder");

/**
 * Creates {@link TextElement} objects from the decoded tile and list of materials specified. The
 * priorities of the {@link TextElement}s are updated to simplify label placement.
 *
 * @param tile - The {@link Tile} to create the testElements on.
 * @param decodedTile - The {@link @here/harp-datasource-protocol#DecodedTile}.
 * @param textFilter -: Optional filter. Should return true for any text technique that is
 *      applicable.
 */
export class PoiBuilder {
    private m_alwaysOnTop?: boolean;

    private readonly m_textElementBuilder: TextElementBuilder;
    private m_iconMinZoomLevel?: number;
    private m_iconMaxZoomLevel?: number;
    private m_textMinZoomLevel?: number;
    private m_textMaxZoomLevel?: number;
    private m_technique?: (PoiTechnique | LineMarkerTechnique) & IndexedTechniqueParams;

    constructor(private readonly m_env: MapEnv | Env, styleCache: TileTextStyleCache) {
        this.m_textElementBuilder = new TextElementBuilder(m_env, styleCache);
    }

    withTechnique(technique: (PoiTechnique | LineMarkerTechnique) & IndexedTechniqueParams): this {
        this.m_textElementBuilder.withTechnique(technique);

        this.m_alwaysOnTop = technique.alwaysOnTop === true;

        this.m_iconMinZoomLevel =
            getPropertyValue(technique.iconMinZoomLevel ?? technique.minZoomLevel, this.m_env) ??
            undefined;
        this.m_iconMaxZoomLevel =
            getPropertyValue(technique.iconMaxZoomLevel ?? technique.maxZoomLevel, this.m_env) ??
            undefined;
        this.m_textMinZoomLevel =
            getPropertyValue(technique.textMinZoomLevel ?? technique.minZoomLevel, this.m_env) ??
            undefined;
        this.m_textMaxZoomLevel =
            getPropertyValue(technique.textMaxZoomLevel ?? technique.maxZoomLevel, this.m_env) ??
            undefined;

        this.m_technique = technique;
        return this;
    }

    build(
        text: string,
        points: THREE.Vector3 | THREE.Vector3[],
        tile: Tile,
        imageTextureName?: string,
        poiTableName?: string,
        poiName?: string,
        attributes?: AttributeMap
    ): TextElement {
        assert(this.m_technique !== undefined);
        const technique = this.m_technique!;
        const env = this.m_env;
        const textElement = this.m_textElementBuilder.build(text, points, tile, attributes);

        // imageTextureName may be undefined if a poiTable is used.
        if (imageTextureName === undefined && poiTableName !== undefined) {
            imageTextureName = "";
        } else if (imageTextureName !== undefined && poiTableName !== undefined) {
            logger.warn(
                "Possible duplicate POI icon definition via imageTextureName and poiTable!"
            );
        }

        if (imageTextureName !== undefined) {
            const textIsOptional = technique.textIsOptional === true;
            const iconIsOptional = technique.iconIsOptional !== false;
            const renderTextDuringMovements = !(technique.renderTextDuringMovements === false);
            const iconMayOverlap =
                technique.iconMayOverlap === undefined
                    ? textElement.textMayOverlap
                    : technique.iconMayOverlap === true;
            const iconReserveSpace =
                technique.iconReserveSpace === undefined
                    ? textElement.textReservesSpace
                    : technique.iconReserveSpace !== false;

            const iconColorRaw = technique.iconColor
                ? getPropertyValue(technique.iconColor, env)
                : null;
            const iconColor =
                iconColorRaw !== null ? ColorCache.instance.getColor(iconColorRaw) : undefined;

            textElement.poiInfo = {
                technique,
                imageTextureName,
                poiTableName,
                poiName,
                shieldGroupIndex,
                textElement,
                textIsOptional,
                iconIsOptional,
                renderTextDuringMovements,
                mayOverlap: iconMayOverlap,
                reserveSpace: iconReserveSpace,
                textElement.featureId,
                iconBrightness: technique.iconBrightness,
                iconColor,
                iconMinZoomLevel:
                    getPropertyValue(technique.iconMinZoomLevel ?? technique.minZoomLevel, env) ??
                    undefined,
                iconMaxZoomLevel:
                    getPropertyValue(technique.iconMaxZoomLevel ?? technique.maxZoomLevel, env) ??
                    undefined,
                textMinZoomLevel:
                    getPropertyValue(technique.textMinZoomLevel ?? technique.minZoomLevel, env) ??
                    undefined,
                textMaxZoomLevel:
                    getPropertyValue(technique.textMaxZoomLevel ?? technique.maxZoomLevel, env) ??
                    undefined
            };
            textElement.updateMinMaxZoomLevelsFromPoiInfo();
        } else {
            // Select the smaller/larger one of the two min/max values, because the TextElement
            // is a container for both.
            if (textElement.minZoomLevel === undefined) {
                textElement.minZoomLevel =
                    getPropertyValue(technique.textMinZoomLevel, env) ?? undefined;
            }

            if (textElement.maxZoomLevel === undefined) {
                textElement.maxZoomLevel =
                    getPropertyValue(technique.textMaxZoomLevel, env) ?? undefined;
            }
        }
        return textElement;
    }
}
