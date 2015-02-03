{
  id: '007aff007aff.ScatterPlot2',
  component: {
    'name': 'Scatter Plot',
    'tooltip': 'Insert Scatter Plot',
    'cssClass': 'scatterplot'
  },
  properties: [

    {key: "regression-lines", label: "Regression Line", type: "lov", value: "none",
      options:[
      {label: "None", value: "none"},
      {label: "Linear", value: "linear"}
      ]
    },
    {key: "reference-lines", label: "Reference Line", type: "lov", value: "none",
      options:[
       {label: "None", value: "none"},
       {label: "Zero", value: "zero"},
       {label: "Median", value: "median"},
       {label: "Mean", value: "mean"}
     ]
    },
    {key: "reference-value", label: "Reference Line Label", type: "boolean", value: "true"},
    {key: "ignore-color", label: "Disable Color", type: "boolean", value: "false"},
    {key: "x-axis-scale", label: "X-Axis Scale", type: "lov", value: "linear",
      options:[
       {label: "Linear", value: "linear"},
       {label: "Log", value: "log"}
      ]
    },
    {key: "y-axis-scale", label: "Y-Axis Scale", type: "lov", value: "linear",
      options:[
       {label: "Linear", value: "linear"},
       {label: "Log", value: "log"}
      ]
    },
    {key: "width", label: "Width", type: "length", value: "800px"},
    {key: "height", label: "Height", type: "length", value: "400px"},
    {key: "circle-min-size", label: "Circle Min Size", type: "number", value: "1"},
    {key: "circle-max-size", label: "Circle Max Size", type: "number", value: "10"},
    {key: "circle-scale", label: "Circle Scale", type: "lov", value: "linear",
      options:[
       {label: "Linear", value: "linear"},
       {label: "Log", value: "log"}
      ]
    },
    {key: "x-axis-label", label: "X-Axis Label", type: "string", value: ""},
    {key: "x-axis-label-visible", label: "Show X-Axis Label", type: "boolean", value: "true"},
    {key: "x-axis-ticks", label: "X-Axis Ticks", type: "number", value: "3"},
    {key: "y-axis-label", label: "Y-Axis Label", type: "string", value: ""},
    {key: "y-axis-label-visible", label: "Show Y-Axis Label", type: "boolean", value: "true"},
    {key: "y-axis-ticks", label: "Y-Axis Ticks", type: "number", value: "3"},
    {key: "line-width", label: "Line Width", type: "length", value: "1.5px"}
  ],

  remoteFiles: [
    {type:'js', location:'asset://d3.v3.min.js', isLoaded: function() {
      return (window['d3'] != null);
    }},
    {type:'js', location:'asset://regression.min.js', isLoaded: function() {
      return (window['regression'] != null);
    }},
    
    // points to css/mystyle.css under assets folder
    {type:'css', location:'asset://scatterplot.css'}
  ],

  fields: [
    {name: "Group by", caption: "Group by", fieldType: "label", dataType: "string"},
    {name: "Color by", caption: "Color by", fieldType: "label", dataType: "string"},
    {name: "X-Axis", caption: "X-Axis", fieldType: "measure", dataType: "number", formula: "summation"},
    {name: "Y-Axis", caption: "Y-Axis", fieldType: "measure", dataType: "number", formula: "summation"},
    {name: "Size", caption: "Size", fieldType: "measure", dataType: "number", formula: "summation"}
  ],
  dataType: 'arrayOfArrays',
  
  /**
   * Main entry point.
   */
  render: function (context, containerElem, data, fields, props) {

    if (data == null || data.length == 0) {
      containerElem.innerHTML += '<p>No Data Found</p>';
      return;
    }
    this.renderPlot(context, containerElem, data, fields, props);
  },

  /**
   * Main rendering logic. 
   *
   * The code is intentionally very procedural for referencing purpose.
   * You can just look through from the top to the bottom to understand
   * how that works.
   *
   */
  renderPlot: function(context, containerElem, rawdata, rawfields, props) {

    // ------------------------------------------------------------
    // data preparation
    // ------------------------------------------------------------

    // overriding defaults for dev/test 
    if (this.isSDK()) {
      props["x-axis-label-visible"] = 'false';
      props["y-axis-label-visible"] = 'false';
      props["regression-lines"] = 'linear';
      props["reference-lines"] = 'median';
      props["ignore-color"] = 'true';
    }

    var _xlabelwidth = props["x-axis-label-visible"] === 'true' ? 30 : 0;
    var _ylabelwidth = props["y-axis-label-visible"] === 'true' ? 30 : 0;
    var margin = {top: 20, right: 15, bottom: 30+_xlabelwidth, left: 30+_ylabelwidth},
      width = parseInt(props["width"].replace(/px/, '')) - margin.left - margin.right,
      height = parseInt(props["height"].replace(/px/, '')) - margin.top - margin.bottom;

    var _this = this;

    // category distinct value for color mapping
    var cats = {};

    // re-create the data array in a different column order.
    // x and y coordination data should come up in
    // index 0 and 1 position in the array of array to make quadtree works.

    // rawdata structure : d - datum
    // d[0] : group by column
    // d[1] : color by column
    // d[2] : x
    // d[3] : y
    // d[4] : size

    // remapped data structure : d - datum
    // d[0] : x
    // d[1] : y
    // d[2] : group by column
    // d[3] : color by column
    // d[4] : size
    var data = [];
    var SINGLE_COLOR_VALUE = '___color___';
    var ignoreColors = props['ignore-color']==="true";
    var _color, _xmin = _ymin = _smin = Number.MAX_VALUE,
        _xmax = _ymax = _smax = Number.MIN_VALUE;
    
    // trying to do all the calculations in this single data iteration.
    rawdata.forEach(function(d){
      _color = ignoreColors ? SINGLE_COLOR_VALUE : d[1];
      cats[_color] = _color;
      data.push([d[2], d[3], d[0], _color, d[4]]);
      
      if (_xmin>d[2]) _xmin = d[2];
      if (_xmax<d[2]) _xmax = d[2];
      if (_ymin>d[3]) _ymin = d[3];
      if (_ymax<d[3]) _ymax = d[3];
      if (_smin>d[4]) _smin = d[4];
      if (_smax<d[4]) _smax = d[4];
    }) ;

    // change the color schema depending on how many column distinct values.
    var colortable = d3.keys(cats).length <10 ? d3.scale.category10() : d3.scale.category20();
    // assign colors
    d3.keys(cats).forEach(function(d, i) {
      cats[d] = colortable(i);
    });
    
    var fields = [ rawfields[2], rawfields[3], rawfields[0], rawfields[1], rawfields[4] ];
    // var X=0, Y=1, ID=2, COLOR=3, SIZE=4, RATIO=1.10;
    var IDX = {X:0, Y:1, ID:2, COLOR:3, SIZE:4};

    // axis strech ratio. Because if we use the min max value directly, 
    // the min and max circles will be on the borders and not looking good 
    // so we strech the axis a bit more here to show all the circles nicely.
    var RATIO=0.1;
    var xmax = _xmax>0 ? _xmax*(1+RATIO) : _xmax*(1-RATIO); 
    var xmin = _xmin>0 ? _xmin*(1-RATIO) : _xmin*(1+RATIO); 
    var ymax = _ymax>0 ? _ymax*(1+RATIO) : _ymax*(1-RATIO); 
    var ymin = _ymin>0 ? _ymin*(1-RATIO) : _ymin*(1+RATIO); 

    // axis scale
    var _xscale = props['x-axis-scale'];
    if (xmin<=1 && _xscale === 'log') {
      console.log('Minimum X value is less than 1. Use linear scale instead.');
      _xscale = 'linear';
    }
    var _yscale = props['y-axis-scale'];
    if (ymin<=1 && _yscale === 'log') {
      console.log('Minimum Y value is less than 1. Use linear scale instead.');
      _yscale = 'linear';
    }

    var x = _xscale === 'log' ? d3.scale.log() : d3.scale.linear();
    var xext = _xscale === 'log' ? [ xmin>1 ? 1 : xmin, xmax] : [ xmin>0 ? 0 : xmin, xmax];
    x.domain(xext).range([ 0, width ]);
    var y = _yscale === 'log' ? d3.scale.log() : d3.scale.linear();
    var yext = _yscale === 'log' ? [ ymin>1 ? 1 : ymin, ymax] : [ ymin>0 ? 0 : ymin, ymax];
    y.domain(yext).range([ height, 0 ]);
      
    var size = props['circle-scale'] ==='log' ? d3.scale.log() : d3.scale.linear();
    size.domain([_smin, _smax])
    .range([ parseInt(props['circle-min-size']), parseInt(props['circle-max-size']) ]);

    // ------------------------------------------------------------
    // rendering 
    // ------------------------------------------------------------

    // refresh the contents.
    // We need this since designer doesn't call refresh. 
    containerElem.innerHTML = '';

    var chart = d3.select(containerElem)
      .append('svg:svg')
      .attr('width', width + margin.right + margin.left)
      .attr('height', height + margin.top + margin.bottom)
      .attr('class', 'chart');

    // plotarea
    var main = chart.append('g')
      .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')
      .attr('width', width)
      .attr('height', height)
      .attr('class', 'main')

    // x-axis
    var xticks = parseInt(props['x-axis-ticks']);
    var xAxis = d3.svg.axis()
      .scale(x)
      .orient('bottom').ticks(xticks);

    main.append('g')
      .attr('transform', 'translate(0,' + height + ')')
      .attr('class', 'main axis date')
      .call(xAxis);

    // y-axis
    var yticks = parseInt(props['y-axis-ticks']);
    var yAxis = d3.svg.axis()
      .scale(y)
      .orient('left').ticks(yticks);

    main.append('g')
      .attr('transform', 'translate(0,0)')
      .attr('class', 'main axis date')
      .call(yAxis)
      .selectAll("text")
      .attr("y", -12)
      .attr("x", 10)
      .attr("transform", "rotate(-90)")
      .style("text-anchor", "end");

    // x-axis label
    if (props["x-axis-label-visible"] === 'true') {
      main.append("text")
        .attr("class", "x label")
        .attr("text-anchor", "middle")
        .attr("x", width/2)
        .attr("y", height + 40)
        .text(props["x-axis-label"] ? props["x-axis-label"] : fields[IDX.X].field.split('/').pop());
    }
    
    // y-axis label
    if (props["y-axis-label-visible"] === 'true') {
      main.append("text")
        .attr("class", "y label")
        .attr("text-anchor", "middle")
        .attr("y", -40)
        .attr("x", -(height/2))
        .attr("dy", ".75em")
        .attr("transform", "rotate(-90)")
        .text(props["y-axis-label"] ? props["y-axis-label"] : fields[IDX.Y].field.split('/').pop());
    }
    
    var g = main.append("svg:g").attr("class","plotarea");
    // circles 
    var circles = g.selectAll("scatter-dots")
      .data(data)
      .enter().append("svg:circle")
      // .attr("r", function(d) { return Math.round(size(d[SIZE])); })
      .attr("r", function(d) { return (size(d[IDX.SIZE])); })
      .attr("class", "circle")
      .attr("style", function(d) { return "stroke:"+cats[d[IDX.COLOR]] + "; stroke-width:"+props['line-width']  ;})
      .attr("cx", function (d,i) { return x(d[IDX.X]); } )
      .attr("cy", function (d) { return y(d[IDX.Y]); } );
      
    // reference lines
    var refline = d3.svg.line()
      .x(function(d){return x(d[0])})
      .y(function(d){return y(d[1])});
    var refType = props['reference-lines'];
    var refValue = props['reference-value'];
    
    if (/^(mean|median)$/.test(refType))  {
      var refx, refy;
      if (refType === 'median') {
        refx = d3.median(data, function(d){return d[IDX.X];}); 
        refy = d3.median(data, function(d){return d[IDX.Y];});
      } else { 
        refx = d3.mean(data, function(d){return d[IDX.X];});
        refy = d3.mean(data, function(d){return d[IDX.Y];});
      }
      g.append("path")
       .datum([[refx,ymin],[refx,ymax]])
       .attr("class","x refline")
       .attr("d", refline);
      g.append("path")
       .datum([[xmin, refy],[xmax,refy]])
       .attr("class","y refline")
       .attr("d", refline);

      if (refValue==='true') { 
        g.append("text")
         .attr("class", "x ref label")
         .attr("text-anchor", "start")
         .attr("x", x(refx) +5)
         .attr("y", y(ymax) +15)
         .text(refType+":"+d3.round(refx,2)); 
        
        g.append("text")
         .attr("class", "y ref label")
         .attr("text-anchor", "end")
         .attr("x", x(xmax) - 5)
         .attr("y", y(refy) - 5)
         .text(refType+":"+d3.round(refy,2)); 
      }
    } else if (refType==='zero'){
      // reflines for y=0 and x=0
      if (xmin < 0) {
        g.append("path")
         .datum([[0,ymin],[0,ymax]])
         .attr("class","refline")
         .attr("d", refline);
      }    
      if (ymin < 0) {
        g.append("path")
         .datum([[xmin,0],[xmax,0]])
         .attr("class","refline")
         .attr("d", refline);
      }
    }

    // regression lines
    var regline = d3.svg.line()
      .x(function(d){return x(d[0])})
      .y(function(d){return y(d[1])});

    var regType = props['regression-lines'];
    if (regType==='linear' && _xscale === 'linear' && _yscale === 'linear')  {
      // nest the data by color
      var ndata = d3.nest().key(function(d){return d[IDX.COLOR];}).entries(data);
      
      ndata.forEach(function(d, i) {
        
        var lcolor = cats[d.key];
        var rg = regression('linear', d.values);

        var lefty = rg.equation[0]*xext[0] + rg.equation[1];
        lefty = Math.max(lefty, yext[0]);
        lefty = Math.min(lefty, yext[1]);
        var leftx = (lefty - rg.equation[1]) / rg.equation[0];
        
        var righty = rg.equation[0]*xext[1] + rg.equation[1];
        righty = Math.max(righty, yext[0]);
        righty = Math.min(righty, yext[1]);
        var rightx = (righty - rg.equation[1]) / rg.equation[0];
        
        g.append("path")
         .datum([ [leftx, lefty], [rightx, righty]])
         .attr("class","regline")
         .attr("d", regline)
         .style("stroke", lcolor);
      });
    }
    
    // ------------------------------------------------------------
    // setup user interaction 
    // ------------------------------------------------------------
    
    var brushCell;
    var quadtree = d3.geom.quadtree()
    .extent([[xmin-1,ymin-1], [(xmax+1), (ymax+1)]])   // data range
    (data);

    
    // make search selection a bit bigger to make users choose dots easier.
    var EXTRA = 5;
    // Find the nodes within the specified rectangle.
    var search = function(quadtree, x0, y0, x3, y3) {
      quadtree.visit(function(node, x1, y1, x2, y2) {
        var p = node.point;
        if (p) p.selected = (p[0] >= x0) && (p[0] < x3+EXTRA) && (p[1] >= y0) && (p[1] < y3+EXTRA);
        return x1 >= x3 || y1 >= y3 || x2 < x0 || y2 < y0;
      });
    };

    // Clear the previously-active brush, if any.
    var brushstart = function (p) {
      console.log("brushstart");

      if (brushCell !== this) {
        d3.select(brushCell).call(brush.clear());
        brushCell = this;
      }
      else
      {
        console.log("marker created");
        xdo._isMarkerAvailable = {};
      }
    };

    // Highlight the selected circles.
    var brushmove = function (){
      console.log("brushmove");
      var extent = brush.extent();
      //console.log(extent);
      circles.each(function(d) { d.selected = false; });
      search(quadtree, extent[0][0], extent[0][1], extent[1][0], extent[1][1]);
      circles.classed("selected", function(d) { return d.selected; });
    };

    // If the brush is empty, select all circles.
    var brushend = function() {
      console.log("brushend");
      // send event to the "mad" system :o)
      var filters = new Array;
      circles.each(function(d) {
        if(d.selected) {
          filters.push({field:fields[IDX.ID].field, value:d[IDX.ID]});
          if (!ignoreColors)
            filters.push({field:fields[IDX.COLOR].field, value:d[IDX.COLOR]});
        }
      });

      // Fire the filter event.
      if (_this.isSDK()) {
        // if it is in sdk, just call handleClickEvent to see the debug info.
        xdo.api.handleClickEvent({id: context.id, filter: filters});
      } else {
        if (_this.isViewer()) {
          if (_this._currentfilters) {
            for (var i=0,l=_this._currentfilters.length;i<l;i++)
            {
              var norefresh = !(i==l-1 && filters.length == 0);
              xdo.app.viewer.GlobalFilter.removeFilter(context.id, _this._currentfilters[i].id, norefresh); // compId, filterId, noreload
            }
          }
          xdo.app.viewer.GlobalFilter.addFilter({id: context.id, filter: filters});
          // save the filter for removing those later.
          _this._currentfilters=filters;
        } else {
          // cancel triggering the filter since it raises error
          // because designer doesn't have globalfilter.
          console.log("In designer now. All events are ignored.");
        }
      }
    };
    // register brush events
    var brush = d3.svg.brush()
      .x(x)
      .y(y)
      .on("brushstart", brushstart)
      .on("brush", brushmove)
      .on("brushend", brushend);

    main.append("g")
      .attr("class", "brush")
      .call(brush);
      
  },

  /**
   *
   */
  isSDK : function()  {
    return (xdo.app === undefined);
  },

  /**
   *
   */
  isViewer : function()  {
    return !( xdo.app && xdo.app.designer && xdo.app.designer.DesignerApplication);
  },

  /**
   *
   */
  refresh: function (context, containerElem, data, fields, props) {
    console.log("refresh called.");
    console.log(xdo._isMarkerAvailable);
    if (this.isViewer() && xdo._isMarkerAvailable) {
      console.log("refresh initiated by itself. no refresh...");
      xdo._isMarkerAvailable=null;
      return;
    }

    containerElem.innerHTML = '';
    this.render(context, containerElem, data, fields, props);
  }
}
