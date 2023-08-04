(() => {
    var server = 'http://127.0.0.1:8080/geoserver';

    var layers = [
        {name: 'ansbach_BD_Pre_Mat_DQA_RCline', bbox: null, cellCount: null},
        {name: 'duisburg_BD_Pre_Mat_DQA_RCline', bbox: null, cellCount: null},
        {name: 'Garmisch_BD_Pre_Mat_DQA_RCline', bbox: null, cellCount: null},
        {name: 'Schweinfurt_BD_Pre_Mat_DQA_RCline', bbox: null, cellCount: null},
        {name: 'R_ansbach_BD_Pre_Mat_DQA_RCline', bbox: null, cellCount: null},
        {name: 'Stanislaus_BD_Pre_Mat_DQA_RCline', bbox: null, cellCount: null},
        {name: 'R_duisburg_BD_Pre_Mat_DQA_RCline', bbox: null, cellCount: null},
        {name: 'djibouti_BD_Pre_Mat_DQA_RCline', bbox: null, cellCount: null},
    ];

    var lngExtent, latExtent, cellSizeCoord;

    var unit = 0.01;            //初始化网格度数

    var selectedLayerName = 'ansbach_BD_Pre_Mat_DQA_RCline';

    var abs = 0;
    /* 
        当welcomeStep=1时为道路长度分析
        当welcomeStep=1时为网格分析
    */
    var welcomeStep = 1;    

    var unitMeter = 111.31955; //纬度每一度的距离（km）

    var interval = 50;  //道路长度图表横坐标增加幅度
	
	var density = null;
          
    var echartsLayer = null;   // cell网格图层

    var myChart1 = null;        // echart1 图表
    var myChart2 = null;        // echart2 图表

    var mat_wms_url = () => {
        //wms地址，用来获取整个图层及图层边界

        return server + '/zydl/wms?service=WMS&version=1.1.0&request=GetCapabilities'
    }

    var mat_wfs_url = (layerName, bbox = null) => {
        //wfs 地址，用来获取图层要素，可筛选

        var place = layerName.split('_BD')[0]
        var url = server 
        + '/wfs?service=WFS&request=GetFeature&version=2.0.0&typeNames=zydl:'
        + place 
        + '_BD_Pre_Mat_DQA_RC&outputFormat=json' 
        + '&count=20000';  //最大要素值20000

        if (bbox) {
            url += `&BBox=${bbox}` 
        }
        return url;
    }
    
   
    $(document).ready(function() {
     
        $('#btn4').click(() => {
            $('#welcome-modal').modal();
        })
     
        $('#welcome-step-go').click(() => {
            analysis()
            $('#welcome-step-go').attr('disabled','disabled');
            $('#screenshot').attr('disabled','disabled');
           
        })
        $('#echart-layer-del').click(() => {
          
            $('#chart1').hide();
            myChart1.dispose();
    
            if (echartsLayer) {
                map.removeLayer(echartsLayer);
            }
            $('#chart2').hide();
            myChart2.dispose();
            setLayerOpacity(1)
            $('#screenshot').attr('disabled','disabled');
        })
    });

    function analysis () {
        

        setParams();
     
        getLayerJson(selectedLayerName)
    
        getLayerInfo(selectedLayerName);
        
        setTimeout(() => {
           if (geoJsonLayers) {
                setLayerOpacity(0.3)
           }
        }, 2000);
        
    }

    function setLayerOpacity (opacity) {
        window.lineOpacity = opacity;
        geoJsonLayers.forEach(layer => {
            layer.eachLayer(function (_layer) {  
                _layer.setStyle({opacity: opacity}) 
            })
        })
    }
    
    function setParams() {
        
        interval = parseInt($('#x-size').val());
        selectedLayerName = $('#area1').val();
        unit = $('#cell-size').val();
		density = $('#density').val()
        
    }

    function getLayerJson (layerName) {
      
        $.ajax({
            url: mat_wfs_url(layerName),
            success: (res) => {
                getRoadData(res);
            }
        })
    }

    function getLayerInfo(layerName) {
        //获取图层边界信息
        // 计算单元格数量
        $.ajax({
            url: mat_wms_url(),
            dataType: 'xml',
            timeout: 5000,
            cache: true,   //禁用缓存
            error: function (xml) {
                console.log("加载XML文档出错!")
                alert("网络错误")
            },
            success: (response) => {

                $(response).find("Layer").find("Layer").each(function() {
                    var item = $(this);
                    var name = item.find("Name").text()
                    layers.forEach((layer) => {
                        if (layer.name === name) {
                            layer.bbox = {
                                minx: Number(item.find("BoundingBox").attr("minx")), //最小经度
                                miny: Number(item.find("BoundingBox").attr("miny")), //最小纬度
                                maxx: Number(item.find("BoundingBox").attr("maxx")), //最大经度
                                maxy: Number(item.find("BoundingBox").attr("maxy"))  //最大纬度
                            }

                            var layerCenter = {
                                lng: (layer.bbox.minx + layer.bbox.maxx) / 2,
                                lat: (layer.bbox.miny + layer.bbox.maxy) / 2
                            }
                            /*
                                abs:
                                在经线上，纬度每差1度，实际距离为111千米；
                                在纬线上，经度每差1度，实际距离为111×cos(θ)千米。
                                （其中θ表示该纬线的纬度除以180 * PI。在不同纬线上，
                                经度每差1度的实际距离是不相等的）
                                来源：百度
                            */ 
                            
                            abs = Math.abs(Math.cos( layerCenter.lat / 180 * Math.PI));
                            
                            layer.cellCount = [
                                Math.ceil((layer.bbox.maxx  - layer.bbox.minx) / (unit / abs)), //列
                                Math.ceil((layer.bbox.maxy  - layer.bbox.miny) / unit) //行
                            ]
                        }
                        
                    })
                });
                fitBounds(layerName);
                createChartData(layerName);
                
            }
        });
    }
    
    

    function fitBounds(layerName) {

        //图层适应屏幕
        layers.forEach(layer => {
            if (layer.name == layerName) {
                var bbox = layer.bbox;
                var southWest = new L.LatLng(bbox.miny, bbox.minx),
                northEast = new L.LatLng(bbox.maxy,bbox.maxx),
                bounds = new L.LatLngBounds(southWest, northEast);
                map.fitBounds(bounds, {padding: [0,0]});
            }
        })
    }

    function getCellBoundry (lngExtent, latExtent, cellSizeCoord, i, j) {
        //获取每个cell的经纬度
        var cellBoundry = ''
       
        var coordLeftBottom = [
            +(lngExtent[0] + i * cellSizeCoord[0]).toFixed(8),
            +(latExtent[0] + j * cellSizeCoord[1]).toFixed(8),
        ];
        var coordRightTop = [
            +(lngExtent[0] + (i+1) * cellSizeCoord[0]).toFixed(8),
            +(latExtent[0] + (j+1) * cellSizeCoord[1]).toFixed(8),
        ]
        cellBoundry = `${coordLeftBottom[1]},${coordLeftBottom[0]},${coordRightTop[1]},${coordRightTop[0]}`;

        return cellBoundry;
    }

    function getRoadData (geojson) {
        //计算echarts 道路长度及数据定位精度数据
       
        var roadData = [];

        if (geojson.features.length) {
            geojson.features.forEach(feature => {
               
                var coordinates = feature.geometry.coordinates[0]
                var line = turf.lineString(coordinates);
                var Losm = turf.length(line, {units: 'meters'});
                // console.log(Losm)
                if (feature.properties.snUID > 0) {
                    //道路长度限制最大2000
                    if (Losm < 2000) {
                        roadData.push({
                            length: Losm,
                            QLP: feature.properties.snMatDis
                        });
                   }
                }
            });
            $('#chart1').show();
            createChart1(roadData);
        }
        
    }

    function createChartData(layerName) {
        //获取echarts 网格data
        var currentLayer = null;
        layers.forEach(layer => {
            if (layer.name === layerName) {
                currentLayer = layer
            }
        })
        if (currentLayer) {
            lngExtent = [currentLayer.bbox.minx, currentLayer.bbox.maxx];
            latExtent = [currentLayer.bbox.miny, currentLayer.bbox.maxy];
            
            cellCount = currentLayer.cellCount;
           
            cellSizeCoord = [
                (lngExtent[1] - lngExtent[0]) / cellCount[0],
                (latExtent[1] - latExtent[0]) / cellCount[1]
            ];
            var cellchartData = [];

            var echartData = [];

            var percent = 0;
            for (let i = 0; i < currentLayer.cellCount[0]; i++) {
                for (let j = 0; j < currentLayer.cellCount[1]; j++) {

                    var bbox = getCellBoundry(lngExtent, latExtent, cellSizeCoord, i, j)
                    var url = mat_wfs_url(layerName, bbox);
                    
                    $.ajax({
                        url: url,
                        success: (res) => {
                            var quota = calculateMat(res);     //每个格子对应的各项指标

                            var length = turf.length(res, {units: 'meters'}) / 1000;

                            //max 45.234
                            var unitArea = (cellSizeCoord[0] * unitMeter * abs) * (cellSizeCoord[1] * unitMeter);
                            var result = density ? quota[density].toFixed(3) : (length / unitArea).toFixed(1);
							var unit = density ? "" : ""
                            cellchartData.push([j, i, result > 0 ? result : -1]);
                       
                            if (quota.QL) {
                                echartData.push({
                                    QL: quota.QL.toFixed(5),
                                    QSN: quota.QSN.toFixed(5),
                                    QSL: quota.QSL.toFixed(5),
                                    QLM: quota.QLM.toFixed(5),
                                    QLT: quota.QLT.toFixed(5),
                                    xData: result
                                })
                            } 
                            percent++
                            if (percent >= currentLayer.cellCount[0] * currentLayer.cellCount[1]) {
                                
                                initCellChart(cellchartData, unit);
                                $('#chart2').show();
                                createChart2(echartData);
                                
                            }
                        }
                    });
                }
            }
        }
    }

    function minmax (data) {
        // 获取每个cell的最大小值
        var colorValue = [];
        for (var i = 0; i < data.length; i++) {
            colorValue.push(Number(data[i][2]));
        }
        var newArr = unique(colorValue).sort(function(a, b){return a - b});
       console.log(newArr,"newArr")
        newArr[newArr.length - 1] =  newArr[newArr.length - 1] >= 10 ? Math.ceil(newArr[newArr.length - 1] / 10) * 10 : newArr[newArr.length - 1];
       
        return [0, newArr[newArr.length - 1]];
    }
    
    function compare(p){ 
        //对象数组比较函数
        //p是对象属性
        return function(m,n){
            var a = m[p];
            var b = n[p];
            return a - b; //升序
        }
    }

    function unique (arr) {
        //数组去重
        return Array.from(new Set(arr))
    }


    function initCellChart (data, unit = "") {
        // 初始化网格echarts
		// console.log(data)
		var minMax = minmax(data);
		var speed;
		// if( <= 1) {
		// 	speed = 0.1;
		// }else if(minMax[1] <= 2) {
		// 	speed = 0.2;
		// } if(minMax[1] <= 10) {
		// 	speed = 1;
		// }else if(minMax[1] <= 50) {
		// 	speed = 5;
		// }else {
		// 	speed = 10;
		// }
		speed = (minMax[1] / 10).toFixed(1);
		// let split = minMax[1] <= 1 ? 0.2 : minMax[1] <= 2 ? 1 : minMax[1] <= 10 ? 2 : minMax[1] <= 100 ? 5 : 10;
		splitNumber = (minMax[1] - minMax[0]) / speed;
		console.log(splitNumber,"splitNumber")
		var colorObj = {
			QL: {
				color: ['#bd0000', '#ff3333', '#ff6666', '#ff9999', '#ffcccc'],
				splitNumber: 0
			},
			QSN: {
				color: ['#c77400', '#ffab33','#ffc066', '#ffd599', '#ffeacc'],
				splitNumber: 0
			},
			QSL: {
				color: ["#007a00", "#33ff34", "#66ff67", "#99ff99", "#ccffcc"],
				splitNumber: 0
			},
			QLM: {
				color: ['#0600c2', '#3a33ff', '#6b66ff', '#9d99ff', '#ceccff'],
				splitNumber: 0
			},
			QLT: {
				color: ['#8e00c2', '#ca33ff', '#d766ff', '#e599ff', '#f2ccff'],
				splitNumber: 0
			},
			QLP: {
				color: ["#070093", "#1c3fbf", "#1482e5", "#70b4eb", "#b4e0f3"],
				splitNumber: (minMax[1] - minMax[0]) / 5
			}
		}
		// console.log(colorObj[density],"demo")
        var COLORS = colorObj[density] ? colorObj[density].color : ["#070093", "#1c3fbf", "#1482e5", "#70b4eb", "#b4e0f3"];
        
        var option = {
            tooltip: {},
            visualMap: {
                title: '道路密度',
                min: minMax[0],
                max: minMax[1],
                precision:0,  
                splitNumber: splitNumber,
                inRange: {
                    color: COLORS.reverse(),
                    opacity: 0.6,
                },
                outOfRange: {
                    color: ["#262626"],
                    opacity: 0.6,
                },
                borderColor: '#ccc',
                borderWidth: 2,
                backgroundColor: '#eee',
                dimension: 2,
                inverse: false,
                top: 110,
                left: 10,
                
            },
            series: [{
                type: 'custom',
                coordinateSystem: 'leaflet',
                unit: unit,
                data: data,
                renderItem: renderItem,
                animation: false,
                itemStyle: {
                    emphasis: {
                        color: 'yellow'
                    },
                    normal: {
                        shadowBlur: 10,
                        shadowOffsetX: -5,
                        shadowOffsetY: -5,
                        shadowColor: 'rgba(0, 0, 0, .2)'
                    }
                },
                encode: {
                    tooltip: 2,
                },
                tooltip: {
                    formatter: function (params) {
                        console.log(params)
                        return params.marker + params.data[2] + unit;
                   }
                }
            }]
        };

        //先删除现有图层
        if (echartsLayer) {
            map.removeLayer(echartsLayer);
        }
        $('#welcome-step-go').removeAttr('disabled');
        $('#screenshot').removeAttr('disabled');
        echartsLayer = L.supermap.echartsLayer(option, {loadWhileAnimating: false}).addTo(map);
        
    }
    
    
    //自定义渲染：
    function renderItem(params, api) {
            
        var context = params.context;
        
        var lngIndex = api.value(0);
        var latIndex = api.value(1);
        var coordLeftTop = [
            +(lngExtent[0] + latIndex * cellSizeCoord[0]).toFixed(8),
            +(latExtent[0] + lngIndex * cellSizeCoord[1]).toFixed(8),
            
        ];
        
        var pointLeftTop = getCoord(params, api, lngIndex, latIndex);

        var pointRightBottom = getCoord(params, api, lngIndex + 1, latIndex + 1);


        return {
            type: 'rect',
            shape: {
                x: pointLeftTop[0],
                y: pointLeftTop[1],
                width: pointRightBottom[0] - pointLeftTop[0],
                height: pointRightBottom[1] - pointLeftTop[1]
            },
            style: api.style({
                stroke: 'rgba(0,0,0,0.1)'
            }),
            styleEmphasis: api.styleEmphasis()
        };
    }

    function getCoord(params, api, lngIndex, latIndex) {
        var coords = params.context.coords || (params.context.coords = []);
        var key = lngIndex + '-' + latIndex;

        return coords[key] || (coords[key] = api.coord([
            +(lngExtent[0] + latIndex * cellSizeCoord[0]).toFixed(8),
            +(latExtent[0] + lngIndex * cellSizeCoord[1]).toFixed(8)
        ]));
    }
    function createChart1(chartData) {
        //创建道路长度-数量-定位精度图
        // var bins = ecStat.histogram(chartData);
        // console.log(bins)
        var newArr = chartData.sort(compare('length'));
        var minLength = 0;
        var maxLength = newArr[newArr.length - 1].length;
        
        var xData = [];     //柱状图横坐标,道路长度范围
        var countData = []; //长度范围内道路个数
        var barData = [];   //qlp * 长度
        var totalLength = []; //总长度
        var qlpData = [];     //qlp纵坐标

        for (let i = minLength; i < maxLength; i += interval) {
            xData.push(i);
            //初始化0，方便加法运算
            countData.push(0);
            barData.push(0);
            totalLength.push(0);
        }
        xData.push(xData[xData.length - 1] + interval);
       
        chartData.forEach((item, index) => {
            for (let j = 0; j < xData.length; j++) {
                if (item.length >= xData[j] && item.length < xData[j + 1]) {
                    countData[j]++;
                    barData[j] += item.QLP * item.length;
                    totalLength[j] += item.length;
                }
            }
        });

        barData.forEach( (item, index) => {
            if (totalLength[index] !== 0) {
                qlpData.push( (barData[index] / totalLength[index]).toFixed(1))
            } else {
                qlpData.push(0);
            }
        })
        console.log(qlpData)

        myChart1 = echarts.init(document.getElementById('chart1'));

        var option = {
            backgroundColor: "#fff",
            title: {
                text: '道路长度-定位精度相关分析',
                textStyle: {
                    fontSize: 16,
                    fontWeight: 400
                }
            },
            toolbox: {
                feature: {
                    saveAsImage: {}
                }
            },
            tooltip: {
                show: true,
                trigger: 'axis',
                confine: true,
                formatter(item) {
                    var html = `
                    <div>
                        <div>${xData[item[0].dataIndex]}~${
                            xData[item[0].dataIndex + 1] 
                        } m</div>
                        `
                    if ( item[0]) {
                        html +=  `
                        <div><span style="width:10px;height:10px;display: inline-block;background:${
                            item[0].color
                        }"></span> ${item[0].data}</div>`
                    }   
                    if (item[1]) {
                        html += ` <div><span style="width:10px;height:10px;display: inline-block;background:${
                            item[1].color
                        }"></span> ${item[1].data}</div>
                    </div>`
                    }
                    return html;
                },
            },
            legend: {
                data:['数量', '定位精度']
            },
            grid: {
                left: '0.5%',
                right: '5%',
                bottom: '0.5%',
                containLabel: true
            },
            xAxis: [{
                    data: countData,
                    show:false
                },
                {
                    data: xData,
                    
                    axisLabel: {
                        interval: 0,
                        show: true,
                        rotate: xData.length > 20 ? 70 : 0
                    },
                    name: '道路长度',
                    position: 'bottom',
                    boundaryGap: false,
                    axisPointer: {
                        show: false,
                    },
                },
            ],
            yAxis: [{
                type: 'value',
                show: true,
                scale: true,
                name: '数量'
            }, {
                type: 'value',
                show: true,
                scale: true,
                name: '定位精度'
            }],
            series: [{
                name:'数量',
                data: countData,
                type: 'bar',
                barGap:'0%',
                yAxisIndex: 0,
                color: '#ffa600',
            }, {
                name:'定位精度',
                data: qlpData,
                type: 'bar',
                yAxisIndex: 1,
                color: '#a329cc',
            }]
        }
        myChart1.setOption(option);
    }
    function createChart2(chartData) {
        //创建道路密度曲线图
       
        var QL = [],
        QSN= [],
        QSL= [],
        QLM= [],
        QLT= [],
        xData= [];

        var dataArr = chartData.sort(compare('xData'));
        dataArr.forEach( item => {
            QL.push(item.QL);
            QSN.push(item.QSN);
            QSL.push(item.QSL);
            QLM.push(item.QLM);
            QLT.push(item.QLT);
            xData.push(item.xData);
        })
        myChart2 = echarts.init(document.getElementById('chart2'));
        var option = {
            backgroundColor: "#fff",
            title: {
                text: '相关分析',
                textStyle: {
                    fontSize: 16,
                    fontWeight: 400
                }
            },
            tooltip: {
                trigger: 'axis',
                axisPointer: {
                    type: 'cross',
                    label: {
                        backgroundColor: '#6a7985'
                    }
                }
            },
            legend: {
                /*
                    长度完整性 QL
                    名称属性完整性 QSN
                    名称长度完整性 QSL
                    数据名称精度 QLM
                    数据类型精度 QLT
                    数据定位精度 QLP
                */
                data: ['长度完整性', '名称属性完整性', '名称长度完整性', '数据名称精度', '数据类型精度']
            },
            toolbox: {
                feature: {
                    saveAsImage: {}
                }
            },
            grid: {
                left: '0.5%',
                right: '8%',
                bottom: '3%',
                containLabel: true,
                backgroundColor: "#ccc"
            },
            xAxis: [
                {
                    type: 'category',
                    boundaryGap: false,
                    data: xData,
                    name: '道路密度'
                }
            ],
            yAxis: [
                {
                    type: 'value',
                    name: '评价指标'
                }
            ],
            series: [
                {
                    name: '长度完整性',
                    type: 'line',
                    emphasis: {
                        focus: 'series'
                    },
                    data: QL,
                    color: '#fe0000'
                },
                {
                    name: '名称属性完整性',
                    type: 'line',
                    color: '#ffa600',
                    emphasis: {
                        focus: 'series'
                    },
                    data: QSN
                },
                {
                    name: '名称长度完整性',
                    type: 'line',
                    color: '#00ff01',
                    emphasis: {
                        focus: 'series'
                    },
                    data: QSL
                },
                {
                    name: '数据名称精度',
                    type: 'line',
                    color: '#120afb',
                    emphasis: {
                        focus: 'series'
                    },
                    data: QLM
                },
                {
                    name: '数据类型精度',
                    type: 'line',
                    color: '#a329cc',
                    emphasis: {
                        focus: 'series'
                    },
                    data:  QLT
                }
            ]
        };
        myChart2.setOption(option);
    }

    function calculateMat (geojson) {
        var Losm = 0;  //snUID>0的所有object的总长度
        var LR = 0;    //Losm + a
        var a = 0;   //snUID=0的所有object的总长度
        var QL = 0;   // 长度完整性QL = LOSM/LR 

        var SNR = 0 ;  //snUID>0的道路个数
        var b = 0;   //snUID>0 and (‘name’为空 and ‘aName’不为空)的道路个数
        var QSN = 0; //(SNR -b)/SNR 名称属性完整性

        var c = 0 ; //所有snUID>0 and (‘name’为空 and ‘aName’不为空)的道路总长度
        var QSL = 0 //(Losm -c）/Losm

        var Lmosm = 0 //“字段snUID>0”且“字段name的属性值=字段aName的属性值”的道路要素总长度
        var QLM = 0 ;//数据名称精度

        var QLP = 0 ; //数据定位精度
        var LPOSM = 0;  //snMatDis 的值 x obj的长度

        var QLT = 0; //数据类型精度
        var Lqlt = 0; //
        
        var coordinates = [];
        var coordinates2 = [];
        var coordinates3 = [];
        var coordinates4 = [];
        var coordinates5 = [];
        var coordinates6 = [];
       
        geojson.features.forEach( item => {
            if (item.properties.snUID > 0) {
                coordinates = item.geometry.coordinates[0];
                var line = turf.lineString(coordinates);
                Losm += turf.length(line, {units: 'meters'});

                SNR++;
                if (item.properties.hasOwnProperty("name") && item.properties.hasOwnProperty("aNAME")) {
                    if (!item.properties.name.length && item.properties.aNAME.length) {
                        b++;
                        coordinates3 = item.geometry.coordinates[0];
                        var line3 = turf.lineString(coordinates3);
                        c += turf.length(line3, {units: 'meters'});
                    }
                  
                    if (item.properties.iNameCmpr !== 1) {
                        coordinates4 = item.geometry.coordinates[0]
                        var line4 = turf.lineString(coordinates4);
                        Lmosm += turf.length(line4, {units: 'meters'});
                    }
                    if (item.properties.iFRCCmpr !== 1) {
                        coordinates6 = item.geometry.coordinates[0];
                        var line6 = turf.lineString(coordinates6);
                        Lqlt += turf.length(line6, {units: 'meters'});
                    }
                }
                if (item.properties.snMatDis > 0) {
                    coordinates5 = item.geometry.coordinates[0]
                    let line5 = turf.lineString(coordinates5);
                    LPOSM += turf.length(line5, {units: 'meters'}) * item.properties.snMatDis;
                }
            } 
            if (item.properties.snUID == 0) {
                coordinates2 = item.geometry.coordinates[0]
                var line2 = turf.lineString(coordinates2);
                a += turf.length(line2, {units: 'meters'});
            }
        })
            if (coordinates5.length) {
               QLP = LPOSM / Losm;
            }

            if (coordinates6.length) {
                
            }
            LR = Losm + a;
            QL = Losm/LR ;

            QSN = (SNR -b) / SNR ;
            QSL = (Losm - c) /Losm;
            QLM = Lmosm / Losm;

            QLT = Lqlt / Losm;

            // console.log('长度完整性QL', QL);  
            // console.log('名称属性完整性', QSN);
            // console.log('名称长度完整性', QSL)
            // console.log('数据名称精度', QLM)
            // console.log('数据定位精度', QLP)
            // console.log('数据类型精度', QLT)
            
            matJson = {
                QL,
                QSN,
                QSL,
                QLM,
                QLP,
                QLT
            }
           return matJson
    }

})()