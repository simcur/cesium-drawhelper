/**
 * Created by thomas on 9/01/14.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * (c) www.geocento.com
 * www.metaaps.com
 *
 */

var DrawHelper = (function() {

    // static variables
    var ellipsoid = Cesium.Ellipsoid.WGS84;

    // constructor
    function _(cesiumWidget, resourcePath) {
        this._scene = cesiumWidget.scene;
        this._tooltip = createTooltip(cesiumWidget.container);
        this._surfaces = [];

        this.resourcePath = resourcePath || "";
        defaultBillboard.iconUrl = this.resourcePath + defaultBillboard.iconUrl;
        dragBillboard.iconUrl = this.resourcePath + dragBillboard.iconUrl;
        dragHalfBillboard.iconUrl = this.resourcePath + dragHalfBillboard.iconUrl;
        this.initialiseHandlers();

        this.enhancePrimitives();

    }

    function normalizeLon(lon) {
        while (lon < -Cesium.Math.PI_OVER_TWO) {
            lon += Cesium.Math.PI;
        }
        while (lon > Cesium.Math.PI_OVER_TWO) {
            lon -= Cesium.Math.PI;
        }
        return lon;
    }

    function computeMoveTranslation(position, initialPosition) {
        var lonMoveAmt = position.longitude - initialPosition.longitude;
        var latMoveAmt = position.latitude - initialPosition.latitude;
        return new Cesium.Cartesian2(normalizeLon(lonMoveAmt), latMoveAmt);
    }


    _.prototype.initialiseHandlers = function() {
        var scene = this._scene;
        var _self = this;
        // scene events
        var handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);

        function callPrimitiveCallback(name, position) {
            if (_self._handlersMuted == true) return;
            var pickedObject = scene.pick(position);
            if (pickedObject && pickedObject.primitive && pickedObject.primitive[name]) {
                pickedObject.primitive[name](position);
            }
        }
        handler.setInputAction(
            function(movement) {
                callPrimitiveCallback('leftClick', movement.position);
            }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
        handler.setInputAction(
            function(movement) {
                callPrimitiveCallback('leftDoubleClick', movement.position);
            }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
        var mouseOutObject;
        handler.setInputAction(
            function(movement) {
                if (_self._handlersMuted == true) return;
                var pickedObject = scene.pick(movement.endPosition);
                if (mouseOutObject && (!pickedObject || mouseOutObject != pickedObject.primitive)) {
                    !(mouseOutObject.isDestroyed && mouseOutObject.isDestroyed()) && mouseOutObject.mouseOut(movement.endPosition);
                    mouseOutObject = null;
                }
                if (pickedObject && pickedObject.primitive) {
                    pickedObject = pickedObject.primitive;
                    if (pickedObject.mouseOut) {
                        mouseOutObject = pickedObject;
                    }
                    if (pickedObject.mouseMove) {
                        pickedObject.mouseMove(movement.endPosition);
                    }
                }
            }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
        handler.setInputAction(
            function(movement) {
                callPrimitiveCallback('leftUp', movement.position);
            }, Cesium.ScreenSpaceEventType.LEFT_UP);
        handler.setInputAction(
            function(movement) {
                callPrimitiveCallback('leftDown', movement.position);
            }, Cesium.ScreenSpaceEventType.LEFT_DOWN);
    }

    _.prototype.setListener = function(primitive, type, callback) {
        primitive[type] = callback;
    }

    _.prototype.muteHandlers = function(muted) {
        this._handlersMuted = muted;
    }

    // register event handling for an editable shape
    // shape should implement setEditMode and setHighlighted
    _.prototype.registerEditableShape = function(surface) {
        var _self = this;

        // handlers for interactions
        // highlight polygon when mouse is entering
        setListener(surface, 'mouseMove', function(position) {
            surface.setHighlighted(true);
            if (!surface._editMode) {
                _self._tooltip.showAt(position, "Click to edit this shape");
            }
        });
        // hide the highlighting when mouse is leaving the polygon
        setListener(surface, 'mouseOut', function(position) {
            surface.setHighlighted(false);
            _self._tooltip.setVisible(false);
        });
        setListener(surface, 'leftClick', function(position) {
            surface.setEditMode(true);
        });
    }

    _.prototype.removeEditableListeners = function(surface) {
        removeListener(surface, 'mouseMove');
        removeListener(surface, 'mouseOut');
        removeListener(surface, 'leftClick');
    }

    _.prototype.startDrawing = function(cleanUp) {
        // undo any current edit of shapes
        this.disableAllEditMode();
        // check for cleanUp first
        if (this.editCleanUp) {
            this.editCleanUp();
        }
        this.editCleanUp = cleanUp;
        this.muteHandlers(true);
    }

    _.prototype.stopDrawing = function() {
        // check for cleanUp first
        if (this.editCleanUp) {
            this.editCleanUp();
            this.editCleanUp = null;
        }
        this.muteHandlers(false);
    }

    // make sure only one shape is highlighted at a time
    _.prototype.disableAllHighlights = function() {
        this.setHighlighted(undefined);
    }

    _.prototype.setHighlighted = function(surface) {
        if (this._highlightedSurface && !this._highlightedSurface.isDestroyed() && this._highlightedSurface != surface) {
            this._highlightedSurface.setHighlighted(false);
        }
        this._highlightedSurface = surface;
    }

    _.prototype.disableAllEditMode = function() {
        this.setEdited(undefined);
    }

    _.prototype.setEdited = function(surface) {
        if (this._editedSurface && !this._editedSurface.isDestroyed()) {
            this._editedSurface.setEditMode(false);
        }
        this._editedSurface = surface;
    }

    var material = Cesium.Material.fromType(Cesium.Material.ColorType);
    material.uniforms.color = new Cesium.Color(1.0, 1.0, 0.0, 0.5);

    var defaultShapeOptions = {
        ellipsoid: Cesium.Ellipsoid.WGS84,
        textureRotationAngle: 0.0,
        height: 0.0,
        asynchronous: true,
        show: true,
        debugShowBoundingVolume: false
    }

    var defaultSurfaceOptions = copyOptions(defaultShapeOptions, {
        appearance: new Cesium.EllipsoidSurfaceAppearance({
            aboveGround: false
        }),
        material: material,
        granularity: Math.PI / 180.0
    });

    var defaultPolygonOptions = copyOptions(defaultShapeOptions, {});
    var defaultExtentOptions = copyOptions(defaultShapeOptions, {});
    var defaultCircleOptions = copyOptions(defaultShapeOptions, {});
    var defaultEllipseOptions = copyOptions(defaultSurfaceOptions, {
        rotation: 0
    });

    var defaultPolylineOptions = copyOptions(defaultShapeOptions, {
        width: 5,
        geodesic: true,
        granularity: 10000,
        appearance: new Cesium.PolylineMaterialAppearance({
            aboveGround: false
        }),
        material: material
    });

    //    Cesium.Polygon.prototype.setStrokeStyle = setStrokeStyle;
    //
    //    Cesium.Polygon.prototype.drawOutline = drawOutline;
    //

    var ChangeablePrimitive = (function() {
        function _() {}

        _.prototype.initialiseOptions = function(options) {

            fillOptions(this, options);

            this._ellipsoid = undefined;
            this._granularity = undefined;
            this._height = undefined;
            this._textureRotationAngle = undefined;
            this._id = undefined;

            // set the flags to initiate a first drawing
            this._createPrimitive = true;
            this._primitive = undefined;
            this._outlinePolygon = undefined;

        }

        _.prototype.setAttribute = function(name, value) {
            this[name] = value;
            this._createPrimitive = true;
        };

        _.prototype.getAttribute = function(name) {
            return this[name];
        };

        /**
         * @private
         */
        _.prototype.update = function(context, frameState, commandList) {

            if (!Cesium.defined(this.ellipsoid)) {
                throw new Cesium.DeveloperError('this.ellipsoid must be defined.');
            }

            if (!Cesium.defined(this.appearance)) {
                throw new Cesium.DeveloperError('this.material must be defined.');
            }

            if (this.granularity < 0.0) {
                throw new Cesium.DeveloperError('this.granularity and scene2D/scene3D overrides must be greater than zero.');
            }

            if (!this.show) {
                return;
            }

            if (!this._createPrimitive && (!Cesium.defined(this._primitive))) {
                // No positions/hierarchy to draw
                return;
            }

            if (this._createPrimitive ||
                (this._ellipsoid !== this.ellipsoid) ||
                (this._granularity !== this.granularity) ||
                (this._height !== this.height) ||
                (this._textureRotationAngle !== this.textureRotationAngle) ||
                (this._id !== this.id)) {

                var geometry = this.getGeometry();
                if (!geometry) {
                    return;
                }

                this._createPrimitive = false;
                this._ellipsoid = this.ellipsoid;
                this._granularity = this.granularity;
                this._height = this.height;
                this._textureRotationAngle = this.textureRotationAngle;
                this._id = this.id;

                this._primitive = this._primitive && this._primitive.destroy();

                this._primitive = new Cesium.Primitive({
                    geometryInstances: new Cesium.GeometryInstance({
                        geometry: geometry,
                        id: this.id,
                        pickPrimitive: this
                    }),
                    appearance: this.appearance,
                    asynchronous: this.asynchronous
                });

                this._outlinePolygon = this._outlinePolygon && this._outlinePolygon.destroy();
                if (this.strokeColor && this.getOutlineGeometry) {
                    // create the highlighting frame
                    this._outlinePolygon = new Cesium.Primitive({
                        geometryInstances: new Cesium.GeometryInstance({
                            geometry: this.getOutlineGeometry(),
                            attributes: {
                                color: Cesium.ColorGeometryInstanceAttribute.fromColor(this.strokeColor)
                            }
                        }),
                        appearance: new Cesium.PerInstanceColorAppearance({
                            flat: true,
                            renderState: {
                                depthTest: {
                                    enabled: true
                                },
                                lineWidth: Math.min(this.strokeWidth || 4.0, Cesium.ContextLimits.maximumAliasedLineWidth)
                            }
                        })
                    });
                }
            }

            var primitive = this._primitive;
            primitive.appearance.material = this.material;
            primitive.debugShowBoundingVolume = this.debugShowBoundingVolume;
            primitive.update(context, frameState, commandList);
            this._outlinePolygon && this._outlinePolygon.update(context, frameState, commandList);

        };

        _.prototype.isDestroyed = function() {
            return false;
        };

        _.prototype.destroy = function() {
            this._primitive = this._primitive && this._primitive.destroy();
            return Cesium.destroyObject(this);
        };

        _.prototype.setStrokeStyle = function(strokeColor, strokeWidth) {
            if (!this.strokeColor || !this.strokeColor.equals(strokeColor) || this.strokeWidth != strokeWidth) {
                this._createPrimitive = true;
                this.strokeColor = strokeColor;
                this.strokeWidth = strokeWidth;
            }
        }

        return _;
    })();

    _.ExtentPrimitive = (function() {
        function _(options) {

            if (!Cesium.defined(options.extent)) {
                throw new Cesium.DeveloperError('Extent is required');
            }

            options = copyOptions(options, defaultSurfaceOptions);

            this.initialiseOptions(options);

            this.setExtent(options.extent);

        }

        _.prototype = new ChangeablePrimitive();

        _.prototype.setExtent = function(extent) {
            this.setAttribute('extent', extent);
        };

        _.prototype.getExtent = function() {
            return this.getAttribute('extent');
        };

        _.prototype.getGeometry = function() {

            if (!Cesium.defined(this.extent)) {
                return;
            }

            return new Cesium.RectangleGeometry({
                rectangle: this.extent,
                height: this.height,
                vertexFormat: Cesium.EllipsoidSurfaceAppearance.VERTEX_FORMAT,
                stRotation: this.textureRotationAngle,
                ellipsoid: this.ellipsoid,
                granularity: this.granularity
            });
        };

        _.prototype.getOutlineGeometry = function() {
            return new Cesium.RectangleOutlineGeometry({
                rectangle: this.extent
            });
        }

        return _;
    })();

    _.PolygonPrimitive = (function() {

        function _(options) {

            options = copyOptions(options, defaultSurfaceOptions);

            this.initialiseOptions(options);

            this.isPolygon = true;

        }

        _.prototype = new ChangeablePrimitive();

        _.prototype.setPositions = function(positions) {
            this.setAttribute('positions', positions);
            if (this._editMode) {
                this._updateMarkers();
            }
        };

        _.prototype.getPositions = function() {
            return this.getAttribute('positions');
        };

        _.prototype.getGeometry = function() {

            if (!Cesium.defined(this.positions) || this.positions.length < 3) {
                return;
            }

            return Cesium.PolygonGeometry.fromPositions({
                positions: this.positions,
                height: this.height,
                vertexFormat: Cesium.EllipsoidSurfaceAppearance.VERTEX_FORMAT,
                stRotation: this.textureRotationAngle,
                ellipsoid: this.ellipsoid,
                granularity: this.granularity
            });
        };

        _.prototype.getOutlineGeometry = function() {
            return Cesium.PolygonOutlineGeometry.fromPositions({
                positions: this.getPositions()
            });
        }

        return _;
    })();

    _.CirclePrimitive = (function() {

        function _(options) {

            if (!(Cesium.defined(options.center) && Cesium.defined(options.radius))) {
                throw new Cesium.DeveloperError('Center and radius are required');
            }

            options = copyOptions(options, defaultSurfaceOptions);

            this.initialiseOptions(options);

            this.setRadius(options.radius);

        }

        _.prototype = new ChangeablePrimitive();

        _.prototype.setCenter = function(center) {
            this.setAttribute('center', center);
        };

        _.prototype.setRadius = function(radius) {
            this.setAttribute('radius', Math.max(0.1, radius));
        };

        _.prototype.getCenter = function() {
            return this.getAttribute('center');
        };

        _.prototype.getRadius = function() {
            return this.getAttribute('radius');
        };

        _.prototype.getGeometry = function() {

            if (!(Cesium.defined(this.center) && Cesium.defined(this.radius))) {
                return;
            }

            return new Cesium.CircleGeometry({
                center: this.center,
                radius: this.radius,
                height: this.height,
                vertexFormat: Cesium.EllipsoidSurfaceAppearance.VERTEX_FORMAT,
                stRotation: this.textureRotationAngle,
                ellipsoid: this.ellipsoid,
                granularity: this.granularity
            });
        };

        _.prototype.getOutlineGeometry = function() {
            return new Cesium.CircleOutlineGeometry({
                center: this.getCenter(),
                radius: this.getRadius()
            });
        }

        return _;
    })();

    _.EllipsePrimitive = (function() {
        function _(options) {

            if (!(Cesium.defined(options.center) && Cesium.defined(options.semiMajorAxis) && Cesium.defined(options.semiMinorAxis))) {
                throw new Cesium.DeveloperError('Center and semi major and semi minor axis are required');
            }

            options = copyOptions(options, defaultEllipseOptions);

            this.initialiseOptions(options);

        }

        _.prototype = new ChangeablePrimitive();

        _.prototype.setCenter = function(center) {
            this.setAttribute('center', center);
            if (this._markers) {
                this._markers.updateBillboardsPositions(this._getMarkerPositions());
            }
        };

        _.prototype.setSemiMajorAxis = function(semiMajorAxis) {
            if (semiMajorAxis < this.getSemiMinorAxis()) return;
            this.setAttribute('semiMajorAxis', semiMajorAxis);
            if (this._markers) {
                this._markers.updateBillboardsPositions(this._getMarkerPositions());
            }
        };

        _.prototype.setSemiMinorAxis = function(semiMinorAxis) {
            if (semiMinorAxis > this.getSemiMajorAxis()) return;
            this.setAttribute('semiMinorAxis', semiMinorAxis);
            if (this._markers) {
                this._markers.updateBillboardsPositions(this._getMarkerPositions());
            }
        };

        _.prototype.setRotation = function(rotation) {
            var result = this.setAttribute('rotation', rotation);
            if (this._markers) {
                this._markers.updateBillboardsPositions(this._getMarkerPositions());
            }
            return result;
        };

        _.prototype.getCenter = function() {
            return this.getAttribute('center');
        };

        _.prototype.getSemiMajorAxis = function() {
            return this.getAttribute('semiMajorAxis');
        };

        _.prototype.getSemiMinorAxis = function() {
            return this.getAttribute('semiMinorAxis');
        };

        _.prototype.getRotation = function() {
            return this.getAttribute('rotation');
        };

        _.prototype.getGeometry = function() {

            if (!(Cesium.defined(this.center) && Cesium.defined(this.semiMajorAxis) && Cesium.defined(this.semiMinorAxis))) {
                return;
            }

            if (this.semiMajorAxis <= 0) {
                this.semiMajorAxis = 1;
            }

            if (this.semiMinorAxis <= 0) {
                this.semiMinorAxis = 1;
            }

            return new Cesium.EllipseGeometry({
                center: this.center,
                semiMajorAxis: this.semiMajorAxis,
                semiMinorAxis: this.semiMinorAxis,
                rotation: this.rotation,
                height: this.height,
                vertexFormat: Cesium.EllipsoidSurfaceAppearance.VERTEX_FORMAT,
                stRotation: this.textureRotationAngle,
                ellipsoid: this.ellipsoid,
                granularity: this.granularity
            });
        };

        _.prototype.getOutlineGeometry = function() {
            return new Cesium.EllipseOutlineGeometry({
                center: this.getCenter(),
                semiMajorAxis: this.getSemiMajorAxis(),
                semiMinorAxis: this.getSemiMinorAxis(),
                rotation: this.getRotation()
            });
        }

        return _;
    })();

    _.PolylinePrimitive = (function() {

        function _(options) {

            options = copyOptions(options, defaultPolylineOptions);

            this.initialiseOptions(options);

        }

        _.prototype = new ChangeablePrimitive();

        _.prototype.setPositions = function(positions) {
            this.setAttribute('positions', positions);
            if (this._editMode) {
                this._updateMarkers();
            }
        };

        _.prototype.setWidth = function(width) {
            this.setAttribute('width', width);
        };

        _.prototype.setGeodesic = function(geodesic) {
            this.setAttribute('geodesic', geodesic);
        };

        _.prototype.getPositions = function() {
            return this.getAttribute('positions');
        };

        _.prototype.getWidth = function() {
            return this.getAttribute('width');
        };

        _.prototype.getGeodesic = function(geodesic) {
            return this.getAttribute('geodesic');
        };

        _.prototype.getGeometry = function() {

            if (!Cesium.defined(this.positions) || this.positions.length < 2) {
                return;
            }

            return new Cesium.PolylineGeometry({
                positions: this.positions,
                height: this.height,
                width: this.width < 1 ? 1 : this.width,
                vertexFormat: Cesium.EllipsoidSurfaceAppearance.VERTEX_FORMAT,
                ellipsoid: this.ellipsoid
            });
        }

        return _;
    })();

    var defaultBillboard = {
        iconUrl: "dragIcon.png",
        shiftX: 0,
        shiftY: 0
    }

    var dragBillboard = {
        iconUrl: "dragIcon.png",
        shiftX: 0,
        shiftY: 0
    }

    var dragHalfBillboard = {
        iconUrl: "dragIconLight.png",
        shiftX: 0,
        shiftY: 0
    }

    _.prototype.createBillboardGroup = function(points, options, callbacks) {
        var markers = new _.BillboardGroup(this, options);
        markers.addBillboards(points, callbacks);
        return markers;
    }

    _.BillboardGroup = function(drawHelper, options) {

        this._drawHelper = drawHelper;
        this._scene = drawHelper._scene;

        this._options = copyOptions(options, defaultBillboard);

        // create one common billboard collection for all billboards
        var b = new Cesium.BillboardCollection();
        this._scene.primitives.add(b);
        this._billboards = b;
        // keep an ordered list of billboards
        this._orderedBillboards = [];
    }

    _.BillboardGroup.prototype.createBillboard = function(position, callbacks) {

        var billboard = this._billboards.add({
            show: true,
            position: position,
            pixelOffset: new Cesium.Cartesian2(this._options.shiftX, this._options.shiftY),
            eyeOffset: new Cesium.Cartesian3(0.0, 0.0, 0.0),
            horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
            verticalOrigin: Cesium.VerticalOrigin.CENTER,
            scale: 1.0,
            image: this._options.iconUrl,
            color: new Cesium.Color(1.0, 1.0, 1.0, 1.0)
        });

        // if editable
        if (callbacks) {
            var _self = this;

            function getIndex() {
                // find index
                for (var i = 0, I = _self._orderedBillboards.length; i < I && _self._orderedBillboards[i] != billboard; ++i);
                return i;
            }
            if (callbacks.dragHandlers) {
                var _self = this;
                setListener(billboard, 'leftDown', function(position) {
                    // TODO - start the drag handlers here
                    // create handlers for mouseOut and leftUp for the billboard and a mouseMove
                    function onDrag(position) {
                        billboard.position = position;
                        // find index
                        for (var i = 0, I = _self._orderedBillboards.length; i < I && _self._orderedBillboards[i] != billboard; ++i);
                        callbacks.dragHandlers.onDrag && callbacks.dragHandlers.onDrag(getIndex(), position);
                    }

                    function onDragEnd(position) {
                        handler.destroy();
                        _self._scene.screenSpaceCameraController.enableInputs = true;
                        callbacks.dragHandlers.onDragEnd && callbacks.dragHandlers.onDragEnd(getIndex(), position);
                    }

                    var handler = new Cesium.ScreenSpaceEventHandler(_self._scene.canvas);

                    handler.setInputAction(function(movement) {
                        var cartesian = _self._scene.camera.pickEllipsoid(movement.endPosition, ellipsoid);
                        if (cartesian) {
                            onDrag(cartesian);
                        } else {
                            onDragEnd(cartesian);
                        }
                    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

                    handler.setInputAction(function(movement) {
                        onDragEnd(_self._scene.camera.pickEllipsoid(movement.position, ellipsoid));
                    }, Cesium.ScreenSpaceEventType.LEFT_UP);

                    _self._scene.screenSpaceCameraController.enableInputs = false;

                    callbacks.dragHandlers.onDragStart && callbacks.dragHandlers.onDragStart(getIndex(), _self._scene.camera.pickEllipsoid(position, ellipsoid));
                });
            }
            if (callbacks.onDoubleClick) {
                setListener(billboard, 'leftDoubleClick', function(position) {
                    callbacks.onDoubleClick(getIndex());
                });
            }
            if (callbacks.onClick) {
                setListener(billboard, 'leftClick', function(position) {
                    callbacks.onClick(getIndex());
                });
            }
            if (callbacks.tooltip) {
                setListener(billboard, 'mouseMove', function(position) {
                    _self._drawHelper._tooltip.showAt(position, callbacks.tooltip());
                });
                setListener(billboard, 'mouseOut', function(position) {
                    _self._drawHelper._tooltip.setVisible(false);
                });
            }
        }

        return billboard;
    }

    _.BillboardGroup.prototype.insertBillboard = function(index, position, callbacks) {
        this._orderedBillboards.splice(index, 0, this.createBillboard(position, callbacks));
    }

    _.BillboardGroup.prototype.addBillboard = function(position, callbacks) {
        this._orderedBillboards.push(this.createBillboard(position, callbacks));
    }

    _.BillboardGroup.prototype.addBillboards = function(positions, callbacks) {
        var index = 0;
        for (; index < positions.length; index++) {
            this.addBillboard(positions[index], callbacks);
        }
    }

    _.BillboardGroup.prototype.updateBillboardsPositions = function(positions) {
        var index = 0;
        for (; index < positions.length; index++) {
            this.getBillboard(index).position = positions[index];
        }
    }

    _.BillboardGroup.prototype.countBillboards = function() {
        return this._orderedBillboards.length;
    }

    _.BillboardGroup.prototype.getBillboard = function(index) {
        return this._orderedBillboards[index];
    }

    _.BillboardGroup.prototype.removeBillboard = function(index) {
        this._billboards.remove(this.getBillboard(index));
        this._orderedBillboards.splice(index, 1);
    }

    _.BillboardGroup.prototype.remove = function() {
        this._billboards = this._billboards && this._billboards.removeAll() && this._billboards.destroy();
    }

    _.BillboardGroup.prototype.setOnTop = function() {
        this._scene.primitives.raiseToTop(this._billboards);
    }

    _.prototype.startDrawingMarker = function(options) {

        var options = copyOptions(options, defaultBillboard);

        this.startDrawing(
            function() {
                if (markers != null) {
                    markers.remove();
                }
                mouseHandler.destroy();
                tooltip.setVisible(false);
            }
        );

        var _self = this;
        var scene = this._scene;
        var primitives = scene.primitives;
        var tooltip = this._tooltip;

        var markers = new _.BillboardGroup(this, options);

        var mouseHandler = new Cesium.ScreenSpaceEventHandler(scene.canvas);

        // Now wait for start
        mouseHandler.setInputAction(function(movement) {
            if (movement.position != null) {
                var cartesian = scene.camera.pickEllipsoid(movement.position, ellipsoid);
                if (cartesian) {
                    markers.addBillboard(cartesian);
                    _self.stopDrawing();
                    options.callback(cartesian);
                }
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        mouseHandler.setInputAction(function(movement) {
            var position = movement.endPosition;
            if (position != null) {
                var cartesian = scene.camera.pickEllipsoid(position, ellipsoid);
                if (cartesian) {
                    tooltip.showAt(position, "<p>Click to add your marker. Position is: </p>" + getDisplayLatLngString(ellipsoid.cartesianToCartographic(cartesian)));
                } else {
                    tooltip.showAt(position, "<p>Click on the globe to add your marker.</p>");
                }
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    }

    _.prototype.startDrawingPolygon = function(options) {
        var options = copyOptions(options, defaultSurfaceOptions);
        this.startDrawingPolyshape(true, options);
    }

    _.prototype.startDrawingPolyline = function(options) {
        var options = copyOptions(options, defaultPolylineOptions);
        this.startDrawingPolyshape(false, options);
    }

    _.prototype.startDrawingPolyshape = function(isPolygon, options) {

        this.startDrawing(
            function() {
                primitives.remove(poly);
                if (markers != null) {
                    markers.remove();
                }
                mouseHandler.destroy();
                tooltip.setVisible(false);
            }
        );

        var _self = this;
        var scene = this._scene;
        var primitives = scene.primitives;
        var tooltip = this._tooltip;

        var minPoints = isPolygon ? 3 : 2;
        var poly;
        if (isPolygon) {
            poly = new DrawHelper.PolygonPrimitive(options);
        } else {
            poly = new DrawHelper.PolylinePrimitive(options);
        }
        poly.asynchronous = false;
        primitives.add(poly);

        var positions = [];
        var markers = new _.BillboardGroup(this, defaultBillboard);

        var mouseHandler = new Cesium.ScreenSpaceEventHandler(scene.canvas);

        // Now wait for start
        mouseHandler.setInputAction(function(movement) {
            if (movement.position != null) {
                var cartesian = scene.camera.pickEllipsoid(movement.position, ellipsoid);
                if (cartesian) {
                    // first click
                    if (positions.length == 0) {
                        positions.push(cartesian.clone());
                        markers.addBillboard(positions[0]);
                    }
                    if (positions.length >= minPoints) {
                        poly.positions = positions;
                        poly._createPrimitive = true;
                    }
                    // add new point to polygon
                    // this one will move with the mouse
                    positions.push(cartesian);
                    // add marker at the new position
                    markers.addBillboard(cartesian);
                }
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        mouseHandler.setInputAction(function(movement) {
            var position = movement.endPosition;
            if (position != null) {
                if (positions.length == 0) {
                    tooltip.showAt(position, "<p>Click to add first point</p>");
                } else {
                    var cartesian = scene.camera.pickEllipsoid(position, ellipsoid);
                    if (cartesian) {
                        positions.pop();
                        // make sure it is slightly different
                        cartesian.y += (1 + Math.random());
                        positions.push(cartesian);
                        if (positions.length >= minPoints) {
                            poly.positions = positions;
                            poly._createPrimitive = true;
                        }
                        // update marker
                        markers.getBillboard(positions.length - 1).position = cartesian;
                        // show tooltip
                        tooltip.showAt(position, "<p>Click to add new point (" + positions.length + ")</p>" + (positions.length > minPoints ? "<p>Double click to finish drawing</p>" : ""));
                    }
                }
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        mouseHandler.setInputAction(function(movement) {
            var position = movement.position;
            if (position != null) {
                if (positions.length < minPoints + 2) {
                    return;
                } else {
                    var cartesian = scene.camera.pickEllipsoid(position, ellipsoid);
                    if (cartesian) {
                        _self.stopDrawing();
                        if (typeof options.callback == 'function') {
                            // remove overlapping ones
                            var index = positions.length - 1;
                            // TODO - calculate some epsilon based on the zoom level
                            var epsilon = Cesium.Math.EPSILON3;
                            for (; index > 0 && positions[index].equalsEpsilon(positions[index - 1], epsilon); index--) {}
                            options.callback(positions.splice(0, index + 1));
                        }
                    }
                }
            }
        }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

    }

    function getExtentCorners(value) {
        return ellipsoid.cartographicArrayToCartesianArray([Cesium.Rectangle.northwest(value), Cesium.Rectangle.northeast(value), Cesium.Rectangle.southeast(value), Cesium.Rectangle.southwest(value)]);
    }

    _.prototype.startDrawingExtent = function(options) {

        var options = copyOptions(options, defaultSurfaceOptions);

        this.startDrawing(
            function() {
                if (extent != null) {
                    primitives.remove(extent);
                }
                if (markers != null) {
                    markers.remove();
                }
                mouseHandler.destroy();
                tooltip.setVisible(false);
            }
        );

        var _self = this;
        var scene = this._scene;
        var primitives = this._scene.primitives;
        var tooltip = this._tooltip;

        var firstPoint = null;
        var extent = null;
        var markers = null;

        var mouseHandler = new Cesium.ScreenSpaceEventHandler(scene.canvas);

        function updateExtent(value) {
            if (extent == null) {
                extent = new Cesium.RectanglePrimitive();
                extent.asynchronous = false;
                primitives.add(extent);
            }
            extent.rectangle = value;
            // update the markers
            var corners = getExtentCorners(value);
            // create if they do not yet exist
            if (markers == null) {
                markers = new _.BillboardGroup(_self, defaultBillboard);
                markers.addBillboards(corners);
            } else {
                markers.updateBillboardsPositions(corners);
            }
        }

        // Now wait for start
        mouseHandler.setInputAction(function(movement) {
            if (movement.position != null) {
                var cartesian = scene.camera.pickEllipsoid(movement.position, ellipsoid);
                if (cartesian) {
                    if (extent == null) {
                        // create the rectangle
                        firstPoint = ellipsoid.cartesianToCartographic(cartesian);
                        var value = getExtent(firstPoint, firstPoint);
                        updateExtent(value);
                    } else {
                        _self.stopDrawing();
                        if (typeof options.callback == 'function') {
                            options.callback(getExtent(firstPoint, ellipsoid.cartesianToCartographic(cartesian)));
                        }
                    }
                }
            }
        }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

        mouseHandler.setInputAction(function(movement) {
            var position = movement.endPosition;
            if (position != null) {
                if (extent == null) {
                    tooltip.showAt(position, "<p>Click to start drawing rectangle</p>");
                } else {
                    var cartesian = scene.camera.pickEllipsoid(position, ellipsoid);
                    if (cartesian) {
                        var value = getExtent(firstPoint, ellipsoid.cartesianToCartographic(cartesian));
                        updateExtent(value);
                        tooltip.showAt(position, "<p>Drag to change rectangle extent</p><p>Click again to finish drawing</p>");
                    }
                }
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    }

    _.prototype.startDrawingCircle = function(options) {

        var options = copyOptions(options, defaultSurfaceOptions);

        this.startDrawing(
            function cleanUp() {
                if (circle != null) {
                    primitives.remove(circle);
                }
                if (markers != null) {
                    markers.remove();
                }
                mouseHandler.destroy();
                tooltip.setVisible(false);
            }
        );

        var _self = this;
        var scene = this._scene;
        var primitives = this._scene.primitives;
        var tooltip = this._tooltip;

        var circle = null;
        var markers = null;

        var mouseHandler = new Cesium.ScreenSpaceEventHandler(scene.canvas);

        // Now wait for start
        mouseHandler.setInputAction(function(movement) {
            if (movement.position != null) {
                var cartesian = scene.camera.pickEllipsoid(movement.position, ellipsoid);
                if (cartesian) {
                    if (circle == null) {
                        // create the circle
                        circle = new _.CirclePrimitive({
                            center: cartesian,
                            radius: 0,
                            asynchronous: false,
                            material: options.material
                        });
                        primitives.add(circle);
                        markers = new _.BillboardGroup(_self, defaultBillboard);
                        markers.addBillboards([cartesian]);
                    } else {
                        if (typeof options.callback == 'function') {
                            options.callback(circle.getCenter(), circle.getRadius());
                        }
                        _self.stopDrawing();
                    }
                }
            }
        }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

        mouseHandler.setInputAction(function(movement) {
            var position = movement.endPosition;
            if (position != null) {
                if (circle == null) {
                    tooltip.showAt(position, "<p>Click to start drawing the circle</p>");
                } else {
                    var cartesian = scene.camera.pickEllipsoid(position, ellipsoid);
                    if (cartesian) {
                        circle.setRadius(Cesium.Cartesian3.distance(circle.getCenter(), cartesian));
                        markers.updateBillboardsPositions(cartesian);
                        tooltip.showAt(position, "<p>Move mouse to change circle radius</p><p>Click again to finish drawing</p>");
                    }
                }
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    };

    _.prototype.startDrawingEllipse = function startDrawingEllipse(options) {

        var options = copyOptions(options, defaultSurfaceOptions);

        this.startDrawing(
            function cleanUp() {
                if (ellipse != null) {
                    primitives.remove(ellipse);
                }
                if (markers != null) {
                    markers.remove();
                }
                mouseHandler.destroy();
                tooltip.setVisible(false);
            }
        );

        var _self = this;
        var scene = this._scene;
        var primitives = this._scene.primitives;
        var tooltip = this._tooltip;

        var ellipse = null;
        var markers = null;

        var mouseHandler = new Cesium.ScreenSpaceEventHandler(scene.canvas);

        // Now wait for start
        mouseHandler.setInputAction(function _onLeftDown(movement) {
            if (movement.position != null) {
                var cartesian = scene.camera.pickEllipsoid(movement.position, ellipsoid);
                if (cartesian) {
                    if (ellipse == null) {
                        ellipse = new _.EllipsePrimitive({
                            ellipsoid: options.ellipsoid || Cesium.Ellipsoid.WGS84,
                            center: cartesian,
                            semiMajorAxis: 1,
                            semiMinorAxis: 1,
                            rotation: 0,
                            height: options.height || 0,
                            vertexFormat: Cesium.EllipsoidSurfaceAppearance.VERTEX_FORMAT,
                            material: options.material,
                            stRotation: 0,
                            granularity: options.granularity || Math.PI / 180.0
                        });

                        ellipse.asynchronous = false;

                        primitives.add(ellipse);
                        markers = new _.BillboardGroup(_self, defaultBillboard);
                        markers.addBillboards([cartesian]);
                    } else {
                        if (typeof options.callback == 'function') {
                            options.callback({
                                center: ellipse.center,
                                rotation: ellipse.rotation,
                                semiMajorAxis: ellipse.semiMajorAxis,
                                semiMinorAxis: ellipse.semiMinorAxis
                            });
                        }
                        _self.stopDrawing();
                    }
                }
            }
        }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

        mouseHandler.setInputAction(function _onMouseMove(movement) {
            var position = movement.endPosition;
            if (position != null) {
                if (ellipse == null) {
                    tooltip.showAt(position, "<p>Click to start drawing the ellipse</p>");
                } else {
                    var cartesian = scene.camera.pickEllipsoid(position, ellipsoid);
                    if (cartesian) {
                        var semiMajorAxis = Cesium.Cartesian3.distance(ellipse.getCenter(), cartesian);
                        ellipse.setSemiMajorAxis(semiMajorAxis);
                        ellipse.setSemiMinorAxis(semiMajorAxis / 3);
                        markers.updateBillboardsPositions(cartesian);
                        tooltip.showAt(position, "<p>Move mouse to change ellipse semi major axis</p><p>Click again to finish drawing</p>");
                    }
                }
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    };

    _.prototype.enhancePrimitives = function() {

        var drawHelper = this;

        Cesium.Billboard.prototype.setEditable = function(isEditable) {
            if (typeof isEditable === 'undefined') {
                isEditable = true;
            }

            if (this.setEditMode === isEditable) {
                return;
            }

            if (isEditable) {
                this._editable = true;

                var billboard = this;
                var _self = this;

                setListener(billboard, 'leftDown', function(position) {
                    // TODO - start the drag handlers here
                    // create handlers for mouseOut and leftUp for the billboard and a mouseMove
                    function onDrag(position) {
                        billboard.position = position;
                        _self.executeListeners({
                            name: 'drag',
                            positions: position
                        });
                    }

                    function onDragEnd(position) {
                        handler.destroy();
                        drawHelper._scene.screenSpaceCameraController.enableInputs = true;
                        _self.executeListeners({
                            name: 'dragEnd',
                            positions: position
                        });
                    }

                    var handler = new Cesium.ScreenSpaceEventHandler(drawHelper._scene.canvas);

                    handler.setInputAction(function(movement) {
                        var cartesian = drawHelper._scene.camera.pickEllipsoid(movement.endPosition, ellipsoid);
                        if (cartesian) {
                            onDrag(cartesian);
                        } else {
                            onDragEnd(cartesian);
                        }
                    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

                    handler.setInputAction(function(movement) {
                        onDragEnd(drawHelper._scene.camera.pickEllipsoid(movement.position, ellipsoid));
                    }, Cesium.ScreenSpaceEventType.LEFT_UP);

                    drawHelper._scene.screenSpaceCameraController.enableInputs = false;
                });

                enhanceWithListeners(billboard);
            } else {
                removeEditableListeners(this);
            }
        }

        function setHighlighted(highlighted) {

            var scene = drawHelper._scene;

            // if no change
            // if already highlighted, the outline polygon will be available
            if (this._highlighted && this._highlighted == highlighted) {
                return;
            }
            // disable if already in edit mode
            if (this._editMode === true) {
                return;
            }
            this._highlighted = highlighted;
            // highlight by creating an outline polygon matching the polygon points
            if (highlighted) {
                // make sure all other shapes are not highlighted
                drawHelper.setHighlighted(this);
                this._strokeColor = this.strokeColor;
                this.setStrokeStyle(Cesium.Color.fromCssColorString('white'), this.strokeWidth);
            } else {
                if (this._strokeColor) {
                    this.setStrokeStyle(this._strokeColor, this.strokeWidth);
                } else {
                    this.setStrokeStyle(undefined, undefined);
                }
            }
        }

        function _updateMarkers() {
            var index;
            var billboard;
            var newMarkerPosition;

            // update "markers" (position handles)
            if (this._markers._orderedBillboards.length < this.positions.length) {
                var markerChangeHandlers = _getMarkerChangeHandlers(this);
                while (this._markers._orderedBillboards.length < this.positions.length) {
                    newMarkerPosition = this.positions[this._markers._orderedBillboards.length - 1];
                    this._markers.addBillboard(newMarkerPosition, markerChangeHandlers);
                }
            }

            while (this._markers._orderedBillboards.length > this.positions.length) {
                this._markers.removeBillboard(this._markers._orderedBillboards.length - 1);
            }

            for (index = 0; index < this.positions.length; index++) {
                billboard = this._markers.getBillboard(index);
                // there may not be a billboard yet if e.g. the user is adding a point
                if (billboard) {
                    billboard.position = this.positions[index].clone();
                }
            }

            // update "edit markers" (mid-position handles)
            var editMarkerLength = this.isPolygon ? this.positions.length : this.positions.length - 1;
            if (this._editMarkers._orderedBillboards.length < editMarkerLength) {
                var editMarkerChangeHandlers = _getEditMarkerChangeHandlers(this);
                while (this._editMarkers._orderedBillboards.length < editMarkerLength) {
                    newMarkerPosition = this.positions[this._editMarkers._orderedBillboards.length - 1];
                    this._editMarkers.addBillboard(newMarkerPosition, editMarkerChangeHandlers);
                }
            }

            while (this._editMarkers._orderedBillboards.length > editMarkerLength) {
                this._editMarkers.removeBillboard(this._editMarkers._orderedBillboards.length - 1);
            }

            // update "edit" ("creation"; mid/half) point marker positions
            for (index = 0; index < editMarkerLength; index++) {
                billboard = this._editMarkers.getBillboard(index);
                if (billboard) {
                    billboard.position = _calculateHalfMarkerPosition(this.positions, index);
                }
            }
        };

        _.PolylinePrimitive.prototype._updateMarkers = _updateMarkers;
        _.PolygonPrimitive.prototype._updateMarkers = _updateMarkers;

        function _calculateHalfMarkerPosition(positions, index) {
            return ellipsoid.cartographicToCartesian(
                new Cesium.EllipsoidGeodesic(ellipsoid.cartesianToCartographic(positions[index]),
                    ellipsoid.cartesianToCartographic(positions[index < positions.length - 1 ? index + 1 : 0])).interpolateUsingFraction(0.5)
            );
        }

        function _getMarkerChangeHandlers(_self) {
            function onEdited() {
                _self.executeListeners({
                    name: 'onEdited',
                    positions: _self.positions
                });
            }

            function updateHalfMarkers(index, positions) {
                // update the half markers before and after the index
                var editIndex = index - 1 < 0 ? positions.length - 1 : index - 1;
                if (editIndex < _self._editMarkers.countBillboards()) {
                    _self._editMarkers.getBillboard(editIndex).position = _calculateHalfMarkerPosition(_self.positions, editIndex);
                }
                editIndex = index;
                if (editIndex < _self._editMarkers.countBillboards()) {
                    _self._editMarkers.getBillboard(editIndex).position = _calculateHalfMarkerPosition(_self.positions, editIndex);
                }
            }

            return {
                dragHandlers: {
                    onDragStart: function(index, position) {
                        _self._handlingDragOperation = true;

                        _self.positions[index] = position;
                        updateHalfMarkers(index, _self.positions);
                        _self._createPrimitive = true;
                    },
                    onDrag: function(index, position) {
                        _self.positions[index] = position;
                        updateHalfMarkers(index, _self.positions);
                        _self._createPrimitive = true;
                    },
                    onDragEnd: function(index, position) {
                        delete _self._handlingDragOperation;
                        onEdited();
                    }
                },
                onDoubleClick: function(index) {
                    var minLength = _self.isPolygon ? 3 : 2;
                    if (_self.positions.length <= minLength) {
                        return;
                    }
                    // remove the point and the corresponding markers
                    _self.positions.splice(index, 1);
                    _self._createPrimitive = true;
                    _self._markers.removeBillboard(index);
                    _self._editMarkers.removeBillboard(index);
                    _self._updateMarkers();
                    onEdited();
                },
                tooltip: function() {
                    if (_self.positions.length - 2 > (_self.isPolygon ? 1 : 0)) {
                        return "Double click to remove this point";
                    }
                }
            };
        }

        function _getEditMarkerChangeHandlers(_self) {
            function onEdited() {
                _self.executeListeners({
                    name: 'onEdited',
                    positions: _self.positions
                });
            }

            return {
                dragHandlers: {
                    onDragStart: function(index, position) {
                        _self._handlingDragOperation = true;

                        // add a new position to the polygon
                        this.index = index + 1;
                        _self.positions.splice(this.index, 0, position);
                        _self._createPrimitive = true;

                        // add a new marker (and "edit" markers)...
                        _self._markers.insertBillboard(this.index, position, _getMarkerChangeHandlers(_self));
                        _self._editMarkers.getBillboard(this.index - 1).position = _calculateHalfMarkerPosition(_self.positions, this.index - 1);
                        _self._editMarkers.insertBillboard(this.index, _calculateHalfMarkerPosition(_self.positions, this.index), _getEditMarkerChangeHandlers(_self));
                    },
                    onDrag: function(index, position) {
                        _self.positions[this.index] = position;
                        _self._createPrimitive = true;

                        _self._markers.getBillboard(this.index).position = position;
                        _self._editMarkers.getBillboard(this.index - 1).position = _calculateHalfMarkerPosition(_self.positions, this.index - 1);
                        _self._editMarkers.getBillboard(this.index).position = _calculateHalfMarkerPosition(_self.positions, this.index);
                    },
                    onDragEnd: function(index, position) {
                        delete _self._handlingDragOperation;
                        onEdited();
                    }
                },
                tooltip: function() {
                    return "Drag to create a new point";
                }
            };
        }

        function setPolyshapeEditMode(editMode) {
            // if no change
            if (this._editMode == editMode) {
                return;
            }
            // make sure all other shapes are not in edit mode before starting the editing of this shape
            drawHelper.disableAllHighlights();
            // display markers
            if (editMode) {
                drawHelper.setEdited(this);
                var scene = drawHelper._scene;
                var _self = this;
                // create the markers and handlers for the editing
                if (this._markers == null) {
                    var markers = new _.BillboardGroup(drawHelper, dragBillboard);
                    var editMarkers = new _.BillboardGroup(drawHelper, dragHalfBillboard);
                    var handleMarkerChanges = _getMarkerChangeHandlers(this);
                    // add billboards and keep an ordered list of them for the polygon edges
                    markers.addBillboards(_self.positions, handleMarkerChanges);
                    this._markers = markers;

                    var halfPositions = [];
                    var index = 0;
                    var length = _self.positions.length + (this.isPolygon ? 0 : -1);
                    for (; index < length; index++) {
                        halfPositions.push(_calculateHalfMarkerPosition(_self.positions, index));
                    }
                    var handleEditMarkerChanges = _getEditMarkerChangeHandlers(this);
                    editMarkers.addBillboards(halfPositions, handleEditMarkerChanges);
                    this._editMarkers = editMarkers;

                    function onEdited() {
                        _self.executeListeners({
                            name: 'onEdited',
                            positions: _self.positions
                        });
                    }

                    var handlePrimitiveChanges = {
                        dragHandlers: {
                            onDragStart: function onDragStart(position) {
                                //// INTIALIZE DRAGGING-OPERATION

                                // setup dragging-operation
                                _self._handlingDragOperation = true;
                                _self._initialPrimitiveDragPosition = position;

                                scene.screenSpaceCameraController.enableInputs = false;

                                _self._screenSpaceEventHandler.setInputAction(function _handleMouseMove(movement) {
                                    var position = scene.camera.pickEllipsoid(movement.endPosition, ellipsoid);
                                    if (position) {
                                        position = ellipsoid.cartesianToCartographic(position);
                                        handlePrimitiveChanges.dragHandlers.onDrag(position);
                                    } else {
                                        handlePrimitiveChanges.dragHandlers.onDragEnd();
                                    }
                                }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

                                _self._screenSpaceEventHandler.setInputAction(function _handleMouseUp(movement) {
                                    var position = scene.camera.pickEllipsoid(movement.position, ellipsoid);
                                    position = ellipsoid.cartesianToCartographic(position);
                                    handlePrimitiveChanges.dragHandlers.onDragEnd(position);
                                }, Cesium.ScreenSpaceEventType.LEFT_UP);
                            },
                            onDrag: function onDrag(position) {
                                //// UPDATE DRAGGING-OPERATION
                                var translation = new Cesium.Cartesian2(position.longitude - _self._initialPrimitiveDragPosition.longitude, position.latitude - _self._initialPrimitiveDragPosition.latitude);

                                // update primitive position
                                // update markers

                                // update polygon primitive positions
                                // update point marker positions
                                var index = 0;
                                var length = _self.positions.length;
                                var positionCart = new Cesium.Cartographic();
                                var billboard;
                                for (; index < length; index++) {
                                    ellipsoid.cartesianToCartographic(_self.positions[index], positionCart);
                                    positionCart.longitude += translation.x;
                                    positionCart.latitude += translation.y;
                                    ellipsoid.cartographicToCartesian(positionCart, _self.positions[index]);
                                    billboard = _self._markers.getBillboard(index);
                                    // there may not be a billboard yet if e.g. the user is adding a point
                                    if (billboard) {
                                        billboard.position = ellipsoid.cartographicToCartesian(positionCart);
                                    }
                                }

                                // update "edit" ("creation"; mid/half) point marker positions
                                length = _self._editMarkers.countBillboards();
                                for (index = 0; index < length; index++) {
                                    _self._editMarkers.getBillboard(index).position = _calculateHalfMarkerPosition(_self.positions, index);
                                }

                                _self._createPrimitive = true;
                                _self._initialPrimitiveDragPosition = position;
                            },
                            onDragEnd: function onDragEnd(position) {
                                //// FINALIZE DRAGGING-OPERATION
                                var translation = new Cesium.Cartesian2(position.longitude - _self._initialPrimitiveDragPosition.longitude, position.latitude - _self._initialPrimitiveDragPosition.latitude);

                                // update primitive position
                                // update markers

                                // update polygon primitive positions
                                // update point marker positions
                                var index = 0;
                                var length = _self.positions.length;
                                var positionCart = new Cesium.Cartographic();
                                var billboard;
                                for (; index < length; index++) {
                                    ellipsoid.cartesianToCartographic(_self.positions[index], positionCart);
                                    positionCart.longitude += translation.x;
                                    positionCart.latitude += translation.y;
                                    ellipsoid.cartographicToCartesian(positionCart, _self.positions[index]);
                                    billboard = _self._markers.getBillboard(index);
                                    // there may not be a billboard yet if e.g. the user is adding a point
                                    if (billboard) {
                                        billboard.position = ellipsoid.cartographicToCartesian(positionCart);
                                    }
                                }

                                // update "edit" ("creation"; mid/half) point marker positions
                                length = _self._editMarkers.countBillboards();
                                for (index = 0; index < length; index++) {
                                    _self._editMarkers.getBillboard(index).position = _calculateHalfMarkerPosition(_self.positions, index);
                                }

                                _self._createPrimitive = true;

                                onEdited();

                                _self._screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
                                _self._screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_UP);

                                scene.screenSpaceCameraController.enableInputs = true;

                                //// cleanup dragging-operation
                                delete _self._handlingDragOperation;
                                delete _self._initialPrimitiveDragPosition;
                            }
                        }
                    };

                    // add a handler for ...
                    this._screenSpaceEventHandler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
                    this._screenSpaceEventHandler.setInputAction(function _handleMouseDown(movement) {
                        var pickedObject = scene.pick(movement.position);
                        if (pickedObject && pickedObject.primitive && pickedObject.primitive === _self && !_self._handlingDragOperation) {
                            var position = ellipsoid.cartesianToCartographic(scene.camera.pickEllipsoid(movement.position, ellipsoid));
                            handlePrimitiveChanges.dragHandlers.onDragStart(position);
                        }
                    }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

                    this._screenSpaceEventHandler.setInputAction(
                        function(movement) {
                            var pickedObject = scene.pick(movement.position);
                            if (!(pickedObject && pickedObject.primitive)) {
                                // user clicked the globe; cancel the edit mode
                                _self.setEditMode(false);
                            }
                        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

                    // set on top of the polygon
                    markers.setOnTop();
                    editMarkers.setOnTop();
                }
                this._editMode = true;
            } else {
                if (this._markers != null) {
                    this._markers.remove();
                    this._editMarkers.remove();
                    this._markers = null;
                    this._editMarkers = null;
                    this._screenSpaceEventHandler.destroy();
                }
                this._editMode = false;
            }

        }

        DrawHelper.PolylinePrimitive.prototype.setEditable = function(isEditable) {
            if (typeof isEditable === 'undefined') {
                isEditable = true;
            }

            if (this.setEditMode === isEditable) {
                return;
            }

            if (isEditable) {
                var polyline = this;
                polyline.isPolygon = false;
                polyline.asynchronous = false;

                drawHelper.registerEditableShape(polyline);

                polyline.setEditMode = setPolyshapeEditMode;

                var originalWidth = this.width;

                polyline.setHighlighted = function(highlighted) {
                    // disable if already in edit mode
                    if (this._editMode === true) {
                        return;
                    }
                    if (highlighted) {
                        drawHelper.setHighlighted(this);
                        this.setWidth(originalWidth * 2);
                    } else {
                        this.setWidth(originalWidth);
                    }
                }

                polyline.getExtent = function() {
                    return Cesium.Extent.fromCartographicArray(ellipsoid.cartesianArrayToCartographicArray(this.positions));
                }

                enhanceWithListeners(polyline);

                polyline.setEditMode(false);
            } else {
                drawHelper.removeEditableListeners(this);
            }
        }

        DrawHelper.PolygonPrimitive.prototype.setEditable = function(isEditable) {
            if (typeof isEditable === 'undefined') {
                isEditable = true;
            }

            if (this.setEditMode === isEditable) {
                return;
            }

            if (isEditable) {
                var polygon = this;
                polygon.asynchronous = false;

                var scene = drawHelper._scene;

                drawHelper.registerEditableShape(polygon);

                polygon.setEditMode = setPolyshapeEditMode;

                polygon.setHighlighted = setHighlighted;

                enhanceWithListeners(polygon);

                polygon.setEditMode(false);
            } else {
                drawHelper.removeEditableListeners(this);
            }
        }

        DrawHelper.ExtentPrimitive.prototype.setEditable = function(isEditable) {
            if (typeof isEditable === 'undefined') {
                isEditable = true;
            }

            if (this.setEditMode === isEditable) {
                return;
            }

            if (isEditable) {
                var extent = this;
                var scene = drawHelper._scene;

                drawHelper.registerEditableShape(extent);
                extent.asynchronous = false;

                extent.setEditMode = function(editMode) {
                    // if no change
                    if (this._editMode == editMode) {
                        return;
                    }
                    var _self = this;
                    drawHelper.disableAllHighlights();
                    // display markers
                    if (editMode) {
                        // make sure all other shapes are not in edit mode before starting the editing of this shape
                        drawHelper.setEdited(this);

                        function isExtentResizeValid(movedCornerIndex, movedCornerCartographic, oppositeCornerCartographic) {
                            var DATELINE_OFFSET = 2.0;
                            var movedCornerPosition;
                            switch (movedCornerIndex) {
                                case 0:
                                    movedCornerPosition = 'nw';
                                    break;
                                case 1:
                                    movedCornerPosition = 'ne';
                                    break;
                                case 2:
                                    movedCornerPosition = 'se';
                                    break;
                                case 3:
                                    movedCornerPosition = 'sw';
                                    break;
                                default:
                                    console.error('This should never happen, index should always be from 0 - 3. It is %d', movedCornerIndex);
                            };

                            var isResizeValid = true;
                            if (movedCornerPosition === 'nw' || movedCornerPosition === 'ne') {
                                if (movedCornerCartographic.latitude < oppositeCornerCartographic.latitude) {
                                    isResizeValid = false;
                                }
                            }

                            if (movedCornerPosition === 'sw' || movedCornerPosition === 'se') {
                                if (movedCornerCartographic.latitude > oppositeCornerCartographic.latitude) {
                                    isResizeValid = false;
                                }
                            }

                            if (movedCornerPosition === 'nw' || movedCornerPosition === 'sw') {
                                //large diff means they are resizing over the dateline
                                var diff = movedCornerCartographic.longitude - oppositeCornerCartographic.longitude;
                                if (movedCornerCartographic.longitude > oppositeCornerCartographic.longitude && diff < DATELINE_OFFSET) {
                                    isResizeValid = false;
                                }
                            }

                            if (movedCornerPosition === 'ne' || movedCornerPosition === 'se') {
                                //large diff means they are resizing over the dateline
                                var diff = oppositeCornerCartographic.longitude - movedCornerCartographic.longitude;
                                if (movedCornerCartographic.longitude < oppositeCornerCartographic.longitude && diff < DATELINE_OFFSET) {
                                    isResizeValid = false;
                                }
                            }

                            return isResizeValid;
                        }

                        // create the markers and handlers for the editing
                        if (this._markers == null) {
                            var markers = new _.BillboardGroup(drawHelper, dragBillboard);

                            function onEdited() {
                                extent.executeListeners({
                                    name: 'onEdited',
                                    extent: extent.extent
                                });
                            }
                            var handleMarkerChanges = {
                                dragHandlers: {
                                    onDrag: function(movedCornerIndex, position) {
                                        var movedCornerCartographic = ellipsoid.cartesianToCartographic(position);
                                        var oppositeCorner = markers.getBillboard((movedCornerIndex + 2) % 4).position;
                                        var oppositeCornerCartographic = ellipsoid.cartesianToCartographic(oppositeCorner);

                                        if (isExtentResizeValid(movedCornerIndex, movedCornerCartographic, oppositeCornerCartographic)) {
                                            extent.setExtent(getExtent(oppositeCornerCartographic, movedCornerCartographic));
                                        }

                                        // outside of the if to put the marker back where it stopped instead of allowing it to continue to move
                                        markers.updateBillboardsPositions(getExtentCorners(extent.extent));
                                    },
                                    onDragEnd: function(index, position) {
                                        onEdited();
                                    }
                                },
                                tooltip: function() {
                                    return "Drag to change the corners of this extent";
                                }
                            };
                            markers.addBillboards(getExtentCorners(extent.extent), handleMarkerChanges);
                            this._markers = markers;

                            var handlePrimitiveChanges = {
                                dragHandlers: {
                                    onDragStart: function onExtentDragStart(position) {
                                        //// INTIALIZE DRAGGING-OPERATION

                                        // setup dragging-operation
                                        _self._handlingDragOperation = true;
                                        _self._initialPrimitiveDragPosition = position;

                                        scene.screenSpaceCameraController.enableInputs = false;

                                        _self._screenSpaceEventHandler.setInputAction(function _handleMouseMove(movement) {
                                            var position = scene.camera.pickEllipsoid(movement.endPosition, ellipsoid);
                                            if (position) {
                                                position = ellipsoid.cartesianToCartographic(position);
                                                handlePrimitiveChanges.dragHandlers.onDrag(position);
                                            } else {
                                                handlePrimitiveChanges.dragHandlers.onDragEnd();
                                            }
                                        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

                                        _self._screenSpaceEventHandler.setInputAction(function _handleMouseUp(movement) {
                                            var position = scene.camera.pickEllipsoid(movement.position, ellipsoid);
                                            position = ellipsoid.cartesianToCartographic(position);
                                            handlePrimitiveChanges.dragHandlers.onDragEnd(position);
                                        }, Cesium.ScreenSpaceEventType.LEFT_UP);
                                    },
                                    onDrag: function onExtentDrag(position) {
                                        var translation = computeMoveTranslation(position, _self._initialPrimitiveDragPosition);
                                        // update extent primitive and marker positions
                                        var corners = getExtentCorners(_self.extent);
                                        var northwestCorner = ellipsoid.cartesianToCartographic(corners[0]);
                                        var southeastCorner = ellipsoid.cartesianToCartographic(corners[2]);

                                        northwestCorner.longitude += translation.x;
                                        northwestCorner.latitude += translation.y;
                                        southeastCorner.longitude += translation.x;
                                        southeastCorner.latitude += translation.y;

                                        // only allow the shape to move if it's not going to move over the pole
                                        if (northwestCorner.latitude < Cesium.Math.PI_OVER_TWO &&
                                            southeastCorner.latitude > -Cesium.Math.PI_OVER_TWO) {
                                            _self._createPrimitive = true;
                                            _self.extent = getExtent(northwestCorner, southeastCorner);
                                            _self._markers.updateBillboardsPositions(getExtentCorners(extent.extent));

                                            _self._initialPrimitiveDragPosition = position;
                                        }
                                    },
                                    onDragEnd: function onExtentDragEnd(position) {
                                        onEdited();

                                        _self._screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
                                        _self._screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_UP);

                                        scene.screenSpaceCameraController.enableInputs = true;

                                        //// cleanup dragging-operation
                                        delete _self._handlingDragOperation;
                                        delete _self._initialPrimitiveDragPosition;
                                    }
                                }
                            };

                            // add a handler for ...
                            this._screenSpaceEventHandler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
                            this._screenSpaceEventHandler.setInputAction(function _handleMouseDown(movement) {
                                var pickedObject = scene.pick(movement.position);
                                if (pickedObject && pickedObject.primitive && pickedObject.primitive === _self && !_self._handlingDragOperation) {
                                    var position = ellipsoid.cartesianToCartographic(scene.camera.pickEllipsoid(movement.position, ellipsoid));
                                    handlePrimitiveChanges.dragHandlers.onDragStart(position);
                                }
                            }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

                            this._screenSpaceEventHandler.setInputAction(
                                function(movement) {
                                    var pickedObject = scene.pick(movement.position);
                                    // disable edit if pickedobject is different or not an object
                                    if (!(pickedObject && pickedObject.isDestroyed && !pickedObject.isDestroyed() && pickedObject.primitive)) {
                                        extent.setEditMode(false);
                                    }
                                }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

                            // set on top of the polygon
                            markers.setOnTop();
                        }
                        this._editMode = true;
                    } else {
                        if (this._markers != null) {
                            this._markers.remove();
                            this._markers = null;
                            this._screenSpaceEventHandler.destroy();
                        }
                        this._editMode = false;
                    }
                }

                extent.setHighlighted = setHighlighted;

                enhanceWithListeners(extent);

                extent.setEditMode(false);
            } else {
                drawHelper.removeEditableListeners(this);
            }
        }


        _.EllipsePrimitive.prototype._getMarkerPositions = function _getMarkerPositions() {
            // TODO(nms): THIS FUNCTION WAS TAKEN FROM CESIUM'S EllipseGeometryLibrary -- needs attribution
            var rotAxis = new Cesium.Cartesian3();
            var tempVec = new Cesium.Cartesian3();
            var unitQuat = new Cesium.Quaternion();
            var rotMtx = new Cesium.Matrix3();

            function pointOnEllipsoid(theta, rotation, northVec, eastVec, aSqr, ab, bSqr, mag, unitPos, result) {
                    var azimuth = theta + rotation;

                    Cesium.Cartesian3.multiplyByScalar(eastVec, Math.cos(azimuth), rotAxis);
                    Cesium.Cartesian3.multiplyByScalar(northVec, Math.sin(azimuth), tempVec);
                    Cesium.Cartesian3.add(rotAxis, tempVec, rotAxis);

                    var cosThetaSquared = Math.cos(theta);
                    cosThetaSquared = cosThetaSquared * cosThetaSquared;

                    var sinThetaSquared = Math.sin(theta);
                    sinThetaSquared = sinThetaSquared * sinThetaSquared;

                    var radius = ab / Math.sqrt(bSqr * cosThetaSquared + aSqr * sinThetaSquared);
                    var angle = radius / mag;

                    // Create the quaternion to rotate the position vector to the boundary of the ellipse.
                    Cesium.Quaternion.fromAxisAngle(rotAxis, angle, unitQuat);
                    Cesium.Matrix3.fromQuaternion(unitQuat, rotMtx);

                    Cesium.Matrix3.multiplyByVector(rotMtx, unitPos, result);
                    Cesium.Cartesian3.normalize(result, result);
                    Cesium.Cartesian3.multiplyByScalar(result, mag, result);
                    return result;
                }
                // TODO(nms): END THIS FUNCTION WAS TAKEN


            var ellipse = this;

            var center = ellipse.getCenter();
            var semiMajorAxis = ellipse.getSemiMajorAxis();
            var semiMinorAxis = ellipse.getSemiMinorAxis();
            var rotation = ellipse.getRotation();

            var aSqr = semiMinorAxis * semiMinorAxis;
            var bSqr = semiMajorAxis * semiMajorAxis;
            var ab = semiMajorAxis * semiMinorAxis;

            var mag = Cesium.Cartesian3.magnitude(center);

            var unitPos = Cesium.Cartesian3.normalize(center, new Cesium.Cartesian3());
            var eastVec = Cesium.Cartesian3.cross(Cesium.Cartesian3.UNIT_Z, center, new Cesium.Cartesian3());
            eastVec = Cesium.Cartesian3.normalize(eastVec, eastVec);
            var northVec = Cesium.Cartesian3.cross(unitPos, eastVec, new Cesium.Cartesian3());

            var positions = [];
            Cesium.Cartesian3.pack(pointOnEllipsoid(Cesium.Math.PI_OVER_TWO, rotation, northVec, eastVec, aSqr, ab, bSqr, mag, unitPos, new Cesium.Cartesian3()), positions, 0);
            Cesium.Cartesian3.pack(pointOnEllipsoid(Cesium.Math.PI, rotation, northVec, eastVec, aSqr, ab, bSqr, mag, unitPos, new Cesium.Cartesian3()), positions, 3);
            Cesium.EllipseGeometryLibrary.raisePositionsToHeight(positions, {
                height: ellipse._height || 0,
                ellipsoid: ellipsoid
            }, false);

            return [
                new Cesium.Cartesian3(positions[0], positions[1], positions[2]),
                new Cesium.Cartesian3(positions[3], positions[4], positions[5])
            ];
        };

        _.EllipsePrimitive.prototype.setEditable = function(isEditable) {
            if (typeof isEditable === 'undefined') {
                isEditable = true;
            }

            if (this.setEditMode === isEditable) {
                return;
            }

            if (isEditable) {
                var ellipse = this;
                var scene = drawHelper._scene;

                ellipse.asynchronous = false;

                drawHelper.registerEditableShape(ellipse);

                ellipse.setEditMode = function(editMode) {
                    // if no change
                    if (this._editMode == editMode) {
                        return;
                    }
                    drawHelper.disableAllHighlights();
                    // display markers
                    if (editMode) {
                        // make sure all other shapes are not in edit mode before starting the editing of this shape
                        drawHelper.setEdited(this);
                        var _self = this;
                        // create the markers and handlers for the editing
                        if (this._markers == null) {
                            var markers = new _.BillboardGroup(drawHelper, dragBillboard);

                            function onEdited() {
                                ellipse.executeListeners({
                                    name: 'onEdited',
                                    center: ellipse.getCenter(),
                                    semiMajorAxis: ellipse.getSemiMajorAxis(),
                                    semiMinorAxis: ellipse.getSemiMinorAxis(),
                                    rotation: ellipse.getRotation()
                                });
                            }
                            var handleMarkerChanges = {
                                dragHandlers: {
                                    onDrag: function(index, position) {
                                        var distance = Cesium.Cartesian3.distance(ellipse.getCenter(), position);
                                        if (index % 2 == 0) {
                                            ellipse.setSemiMajorAxis(distance);
                                        } else {
                                            ellipse.setSemiMinorAxis(distance);
                                        }
                                        markers.updateBillboardsPositions(ellipse._getMarkerPositions());
                                    },
                                    onDragEnd: function(index, position) {
                                        onEdited();
                                    }
                                },
                                tooltip: function() {
                                    return "Drag to change the excentricity and radius";
                                }
                            };
                            markers.addBillboards(ellipse._getMarkerPositions(), handleMarkerChanges);
                            this._markers = markers;

                            var handlePrimitiveChanges = {
                                dragHandlers: {
                                    onDragStart: function onDragStart(position) {
                                        //// INTIALIZE DRAGGING-OPERATION

                                        // setup dragging-operation
                                        _self._handlingDragOperation = true;
                                        _self._initialPrimitiveDragPosition = position;

                                        scene.screenSpaceCameraController.enableInputs = false;

                                        _self._screenSpaceEventHandler.setInputAction(function _handleMouseMove(movement) {
                                            var position = scene.camera.pickEllipsoid(movement.endPosition, ellipsoid);
                                            if (position) {
                                                position = ellipsoid.cartesianToCartographic(position);
                                                handlePrimitiveChanges.dragHandlers.onDrag(position);
                                            } else {
                                                handlePrimitiveChanges.dragHandlers.onDragEnd();
                                            }
                                        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

                                        _self._screenSpaceEventHandler.setInputAction(function _handleMouseUp(movement) {
                                            var position = scene.camera.pickEllipsoid(movement.position, ellipsoid);
                                            position = ellipsoid.cartesianToCartographic(position);
                                            handlePrimitiveChanges.dragHandlers.onDragEnd(position);
                                        }, Cesium.ScreenSpaceEventType.LEFT_UP);
                                    },
                                    onDrag: function onDrag(position) {
                                        //// UPDATE DRAGGING-OPERATION
                                        var translation = new Cesium.Cartesian2(position.longitude - _self._initialPrimitiveDragPosition.longitude, position.latitude - _self._initialPrimitiveDragPosition.latitude);

                                        var centerCart = new Cesium.Cartographic();
                                        ellipsoid.cartesianToCartographic(_self.center, centerCart);
                                        centerCart.longitude += translation.x;
                                        centerCart.latitude += translation.y;
                                        ellipsoid.cartographicToCartesian(centerCart, _self.center);

                                        markers.updateBillboardsPositions(_self._getMarkerPositions());

                                        _self._createPrimitive = true;

                                        _self._initialPrimitiveDragPosition = position;
                                    },
                                    onDragEnd: function onDragEnd(position) {
                                        //// FINALIZE DRAGGING-OPERATION
                                        var translation = new Cesium.Cartesian2(position.longitude - _self._initialPrimitiveDragPosition.longitude, position.latitude - _self._initialPrimitiveDragPosition.latitude);

                                        var centerCart = new Cesium.Cartographic();
                                        ellipsoid.cartesianToCartographic(_self.center, centerCart);
                                        centerCart.longitude += translation.x;
                                        centerCart.latitude += translation.y;
                                        ellipsoid.cartographicToCartesian(centerCart, _self.center);

                                        markers.updateBillboardsPositions(_self._getMarkerPositions());

                                        _self._createPrimitive = true;

                                        onEdited();

                                        _self._screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
                                        _self._screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_UP);

                                        scene.screenSpaceCameraController.enableInputs = true;

                                        //// cleanup dragging-operation
                                        delete _self._handlingDragOperation;
                                        delete _self._initialPrimitiveDragPosition;
                                    }
                                }
                            };

                            // add a handler for ...
                            this._screenSpaceEventHandler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
                            this._screenSpaceEventHandler.setInputAction(function _handleMouseDown(movement) {
                                var pickedObject = scene.pick(movement.position);
                                if (pickedObject && pickedObject.primitive && pickedObject.primitive === _self && !_self._handlingDragOperation) {
                                    var position = ellipsoid.cartesianToCartographic(scene.camera.pickEllipsoid(movement.position, ellipsoid));
                                    handlePrimitiveChanges.dragHandlers.onDragStart(position);
                                }
                            }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

                            this._screenSpaceEventHandler.setInputAction(
                                function(movement) {
                                    var pickedObject = scene.pick(movement.position);
                                    if (!(pickedObject && pickedObject.primitive)) {
                                        // user clicked the globe; cancel the edit mode
                                        _self.setEditMode(false);
                                    }
                                }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

                            // set on top of the polygon
                            markers.setOnTop();
                        }
                        this._editMode = true;
                    } else {
                        if (this._markers != null) {
                            this._markers.remove();
                            this._markers = null;
                            this._screenSpaceEventHandler.destroy();
                        }
                        this._editMode = false;
                    }
                }

                ellipse.setHighlighted = setHighlighted;

                enhanceWithListeners(ellipse);

                ellipse.setEditMode(false);
            } else {
                drawHelper.removeEditableListeners(this);
            }
        }

        _.CirclePrimitive.prototype.getCircleCartesianCoordinates = function(granularity) {
            var geometry = Cesium.CircleOutlineGeometry.createGeometry(new Cesium.CircleOutlineGeometry({
                ellipsoid: ellipsoid,
                center: this.getCenter(),
                radius: this.getRadius(),
                granularity: granularity
            }));
            var count = 0,
                value, values = [];
            for (; count < geometry.attributes.position.values.length; count += 3) {
                value = geometry.attributes.position.values;
                values.push(new Cesium.Cartesian3(value[count], value[count + 1], value[count + 2]));
            }
            return values;
        };

        _.CirclePrimitive.prototype.setEditable = function(isEditable) {
            if (typeof isEditable === 'undefined') {
                isEditable = true;
            }

            if (this.setEditMode === isEditable) {
                return;
            }

            if (isEditable) {
                var circle = this;
                var scene = drawHelper._scene;

                circle.asynchronous = false;

                drawHelper.registerEditableShape(circle);

                circle.setEditMode = function(editMode) {
                    // if no change
                    if (this._editMode == editMode) {
                        return;
                    }
                    drawHelper.disableAllHighlights();
                    // display markers
                    if (editMode) {
                        // make sure all other shapes are not in edit mode before starting the editing of this shape
                        drawHelper.setEdited(this);
                        var _self = this;
                        // create the markers and handlers for the editing
                        if (this._markers == null) {
                            var markers = new _.BillboardGroup(drawHelper, dragBillboard);
                            _self._getMarkerPositions = function() {
                                return _self.getCircleCartesianCoordinates(Cesium.Math.PI_OVER_TWO);
                            };

                            function onEdited() {
                                circle.executeListeners({
                                    name: 'onEdited',
                                    center: circle.getCenter(),
                                    radius: circle.getRadius()
                                });
                            }
                            var handleMarkerChanges = {
                                dragHandlers: {
                                    onDrag: function(index, position) {
                                        circle.setRadius(Cesium.Cartesian3.distance(circle.getCenter(), position));
                                        markers.updateBillboardsPositions(_self._getMarkerPositions());
                                    },
                                    onDragEnd: function(index, position) {
                                        onEdited();
                                    }
                                },
                                tooltip: function() {
                                    return "Drag to change the radius";
                                }
                            };
                            markers.addBillboards(_self._getMarkerPositions(), handleMarkerChanges);
                            this._markers = markers;

                            var handlePrimitiveChanges = {
                                dragHandlers: {
                                    onDragStart: function onDragStart(position) {
                                        //// INTIALIZE DRAGGING-OPERATION

                                        // setup dragging-operation
                                        _self._handlingDragOperation = true;
                                        _self._initialPrimitiveDragPosition = position;

                                        scene.screenSpaceCameraController.enableInputs = false;

                                        _self._screenSpaceEventHandler.setInputAction(function _handleMouseMove(movement) {
                                            var position = scene.camera.pickEllipsoid(movement.endPosition, ellipsoid);
                                            if (position) {
                                                position = ellipsoid.cartesianToCartographic(position);
                                                handlePrimitiveChanges.dragHandlers.onDrag(position);
                                            } else {
                                                handlePrimitiveChanges.dragHandlers.onDragEnd();
                                            }
                                        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

                                        _self._screenSpaceEventHandler.setInputAction(function _handleMouseUp(movement) {
                                            var position = scene.camera.pickEllipsoid(movement.position, ellipsoid);
                                            position = ellipsoid.cartesianToCartographic(position);
                                            handlePrimitiveChanges.dragHandlers.onDragEnd(position);
                                        }, Cesium.ScreenSpaceEventType.LEFT_UP);
                                    },
                                    onDrag: function onDrag(position) {
                                        //// UPDATE DRAGGING-OPERATION
                                        var translation = new Cesium.Cartesian2(position.longitude - _self._initialPrimitiveDragPosition.longitude, position.latitude - _self._initialPrimitiveDragPosition.latitude);

                                        var centerCart = new Cesium.Cartographic();
                                        ellipsoid.cartesianToCartographic(_self.center, centerCart);
                                        centerCart.longitude += translation.x;
                                        centerCart.latitude += translation.y;
                                        ellipsoid.cartographicToCartesian(centerCart, _self.center);

                                        markers.updateBillboardsPositions(_self._getMarkerPositions());

                                        _self._createPrimitive = true;

                                        _self._initialPrimitiveDragPosition = position;
                                    },
                                    onDragEnd: function onDragEnd(position) {
                                        //// FINALIZE DRAGGING-OPERATION
                                        var translation = new Cesium.Cartesian2(position.longitude - _self._initialPrimitiveDragPosition.longitude, position.latitude - _self._initialPrimitiveDragPosition.latitude);

                                        var centerCart = new Cesium.Cartographic();
                                        ellipsoid.cartesianToCartographic(_self.center, centerCart);
                                        centerCart.longitude += translation.x;
                                        centerCart.latitude += translation.y;
                                        ellipsoid.cartographicToCartesian(centerCart, _self.center);

                                        markers.updateBillboardsPositions(_self._getMarkerPositions());

                                        _self._createPrimitive = true;

                                        onEdited();

                                        _self._screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
                                        _self._screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_UP);

                                        scene.screenSpaceCameraController.enableInputs = true;

                                        //// cleanup dragging-operation
                                        delete _self._handlingDragOperation;
                                        delete _self._initialPrimitiveDragPosition;
                                    }
                                }
                            }

                            // add a handler for ...
                            this._screenSpaceEventHandler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
                            this._screenSpaceEventHandler.setInputAction(function _handleMouseDown(movement) {
                                var pickedObject = scene.pick(movement.position);
                                if (pickedObject && pickedObject.primitive && pickedObject.primitive === _self && !_self._handlingDragOperation) {
                                    var position = ellipsoid.cartesianToCartographic(scene.camera.pickEllipsoid(movement.position, ellipsoid));
                                    handlePrimitiveChanges.dragHandlers.onDragStart(position);
                                }
                            }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

                            this._screenSpaceEventHandler.setInputAction(function(movement) {
                                var pickedObject = scene.pick(movement.position);
                                if (!(pickedObject && pickedObject.primitive)) {
                                    // user clicked the globe; cancel the edit mode
                                    _self.setEditMode(false);
                                }
                            }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

                            // set on top of the polygon
                            markers.setOnTop();
                        }
                        this._editMode = true;
                    } else {
                        if (this._markers != null) {
                            this._markers.remove();
                            this._markers = null;
                            this._screenSpaceEventHandler.destroy();
                        }
                        this._editMode = false;
                    }
                }

                circle.setHighlighted = setHighlighted;

                enhanceWithListeners(circle);

                circle.setEditMode(false);
            } else {
                drawHelper.removeEditableListeners(this);
            }
        }

    }

    _.DrawHelperWidget = (function() {

        // constructor
        function _(drawHelper, options) {

            // container must be specified
            if (!(Cesium.defined(options.container))) {
                throw new Cesium.DeveloperError('Container is required');
            }

            var drawOptions = {
                markerIcon: drawHelper.resourcePath + "glyphicons_242_google_maps.png",
                polylineIcon: drawHelper.resourcePath + "glyphicons_097_vector_path_line.png",
                polygonIcon: drawHelper.resourcePath + "glyphicons_096_vector_path_polygon.png",
                circleIcon: drawHelper.resourcePath + "glyphicons_095_vector_path_circle.png",
                ellipseIcon: drawHelper.resourcePath + "glyphicons_095_vector_path_ellipse.png",
                extentIcon: drawHelper.resourcePath + "glyphicons_094_vector_path_square.png",
                clearIcon: drawHelper.resourcePath + "glyphicons_067_cleaning.png",
                polylineDrawingOptions: defaultPolylineOptions,
                polygonDrawingOptions: defaultPolygonOptions,
                extentDrawingOptions: defaultExtentOptions,
                circleDrawingOptions: defaultCircleOptions,
                circleEllipseOptions: defaultEllipseOptions
            };

            fillOptions(options, drawOptions);

            var _self = this;

            var toolbar = document.createElement('DIV');
            toolbar.className = "toolbar";
            options.container.appendChild(toolbar);

            function addIcon(id, url, title, callback) {
                var div = document.createElement('DIV');
                div.className = 'button';
                div.title = title;
                toolbar.appendChild(div);
                div.onclick = callback;
                var span = document.createElement('SPAN');
                div.appendChild(span);
                var image = document.createElement('IMG');
                image.src = url;
                span.appendChild(image);
                return div;
            }

            var scene = drawHelper._scene;

            addIcon('marker', options.markerIcon, 'Click to start drawing a 2D marker', function() {
                drawHelper.startDrawingMarker({
                    callback: function(position) {
                        _self.executeListeners({
                            name: 'markerCreated',
                            position: position
                        });
                    }
                });
            })

            addIcon('polyline', options.polylineIcon, 'Click to start drawing a 2D polyline', function() {
                drawHelper.startDrawingPolyline({
                    callback: function(positions) {
                        _self.executeListeners({
                            name: 'polylineCreated',
                            positions: positions
                        });
                    }
                });
            })

            addIcon('polygon', options.polygonIcon, 'Click to start drawing a 2D polygon', function() {
                drawHelper.startDrawingPolygon({
                    callback: function(positions) {
                        _self.executeListeners({
                            name: 'polygonCreated',
                            positions: positions
                        });
                    }
                });
            })

            addIcon('extent', options.extentIcon, 'Click to start drawing an Extent', function() {
                drawHelper.startDrawingExtent({
                    callback: function(extent) {
                        _self.executeListeners({
                            name: 'extentCreated',
                            extent: extent
                        });
                    }
                });
            })

            addIcon('circle', options.circleIcon, 'Click to start drawing a Circle', function() {
                drawHelper.startDrawingCircle({
                    callback: function(center, radius) {
                        _self.executeListeners({
                            name: 'circleCreated',
                            center: center,
                            radius: radius
                        });
                    }
                });
            })

            addIcon('ellipse', options.ellipseIcon, 'Click to start drawing an Ellipse', function() {
                drawHelper.startDrawingEllipse({
                    callback: function(ellipse) {
                        _self.executeListeners({
                            name: 'ellipseCreated',
                            ellipse: ellipse
                        });
                    }
                });
            })

            // add a clear button at the end
            // add a divider first
            var div = document.createElement('DIV');
            div.className = 'divider';
            toolbar.appendChild(div);
            addIcon('clear', options.clearIcon, 'Remove all primitives', function() {
                scene.primitives.removeAll();
            });

            enhanceWithListeners(this);

        }

        return _;

    })();

    _.prototype.addToolbar = function(container, options) {
        options = copyOptions(options, {
            container: container
        });
        return new _.DrawHelperWidget(this, options);
    }

    function getExtent(corner, oppositeCorner) {
        var extent = new Cesium.Rectangle();

        // Re-order so west < east and south < north
        extent.west = Math.min(corner.longitude, oppositeCorner.longitude);
        extent.east = Math.max(corner.longitude, oppositeCorner.longitude);
        extent.south = Math.min(corner.latitude, oppositeCorner.latitude);
        extent.north = Math.max(corner.latitude, oppositeCorner.latitude);

        // Check for approx equal (shouldn't require abs due to re-order)
        var epsilon = Cesium.Math.EPSILON7;

        if ((extent.east - extent.west) < epsilon) {
            extent.east += epsilon * 2.0;
        }

        if ((extent.north - extent.south) < epsilon) {
            extent.north += epsilon * 2.0;
        }

        // swap east and west values to make the rectangle the smallest possible, this is to work around dateline issues
        var shouldSwap = false;
        if (Math.abs(corner.longitude - oppositeCorner.longitude) > Math.PI) {
            var diff = corner.longitude - oppositeCorner.longitude;
            var normalizedDiff = normalizeLon(corner.longitude) - normalizeLon(oppositeCorner.longitude);
            if (Math.abs(normalizedDiff) < Math.abs(diff)) {
                shouldSwap = true;
            }
        }

        if (shouldSwap) {
            var temp = extent.west;
            extent.west = extent.east;
            extent.east = temp;
        }

        return extent;
    };

    function createTooltip(frameDiv) {

        var tooltip = function(frameDiv) {

            var div = document.createElement('DIV');
            div.className = "twipsy right";

            var arrow = document.createElement('DIV');
            arrow.className = "twipsy-arrow";
            div.appendChild(arrow);

            var title = document.createElement('DIV');
            title.className = "twipsy-inner";
            div.appendChild(title);

            this._div = div;
            this._title = title;

            // add to frame div and display coordinates
            frameDiv.appendChild(div);
        }

        tooltip.prototype.setVisible = function(visible) {
            this._div.style.display = visible ? 'block' : 'none';
        }

        tooltip.prototype.showAt = function(position, message) {
            if (position && message) {
                this.setVisible(true);
                this._title.innerHTML = message;
                this._div.style.left = position.x + 10 + "px";
                this._div.style.top = (position.y - this._div.clientHeight / 2) + "px";
            }
        }

        return new tooltip(frameDiv);
    }

    function getDisplayLatLngString(cartographic, precision) {
        return cartographic.longitude.toFixed(precision || 3) + ", " + cartographic.latitude.toFixed(precision || 3);
    }

    function clone(from, to) {
        if (from == null || typeof from != "object") return from;
        if (from.constructor != Object && from.constructor != Array) return from;
        if (from.constructor == Date || from.constructor == RegExp || from.constructor == Function ||
            from.constructor == String || from.constructor == Number || from.constructor == Boolean)
            return new from.constructor(from);

        to = to || new from.constructor();

        for (var name in from) {
            to[name] = typeof to[name] == "undefined" ? clone(from[name], null) : to[name];
        }

        return to;
    }

    function fillOptions(options, defaultOptions) {
        options = options || {};
        var option;
        for (option in defaultOptions) {
            if (options[option] === undefined) {
                options[option] = clone(defaultOptions[option]);
            }
        }
    }

    // shallow copy
    function copyOptions(options, defaultOptions) {
        var newOptions = clone(options),
            option;
        for (option in defaultOptions) {
            if (newOptions[option] === undefined) {
                newOptions[option] = clone(defaultOptions[option]);
            }
        }
        return newOptions;
    }

    function setListener(primitive, type, callback) {
        primitive[type] = callback;
    }

    function removeListener(primitive, type) {
        delete primitive[type];
    }

    function enhanceWithListeners(element) {

        element._listeners = {};

        element.addListener = function(name, callback) {
            this._listeners[name] = (this._listeners[name] || []);
            this._listeners[name].push(callback);
            return this._listeners[name].length;
        }

        element.executeListeners = function(event, defaultCallback) {
            if (this._listeners[event.name] && this._listeners[event.name].length > 0) {
                var index = 0;
                for (; index < this._listeners[event.name].length; index++) {
                    this._listeners[event.name][index](event);
                }
            } else {
                if (defaultCallback) {
                    defaultCallback(event);
                }
            }
        }

    }

    return _;
})();
