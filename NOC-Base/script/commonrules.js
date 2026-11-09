// JavaScript source code
function Common_t20OccCount(floor) {
    if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 3).toUpperCase() == "RES") {
        return Math.floor(floor.built_area / 12.5);
    }
    else if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 4).toUpperCase() == "EDU1") {
        return Math.floor(floor.built_area / 4);
    }
    else if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 4).toUpperCase() == "EDU2") {
        return Math.floor(floor.built_area / 12.5);
    }
    else if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 4).toUpperCase() == "INS1") {
        return Math.floor(floor.built_area / 10);
    }
    else if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 4).toUpperCase() == "INS2") {
        return Math.floor(floor.built_area / 15);
    }
    else if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 4).toUpperCase() == "ASM1") {
        return Math.floor(floor.seats_num * 1.2);//need to modify
    }
    else if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 4).toUpperCase() == "ASM3") {
        return Math.floor(floor.built_area / 0.65);
    }
    else if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 4).toUpperCase() == "ASM4") {
        return Math.floor(floor.built_area / 1.40);
    }
    else if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 4).toUpperCase() == "ASM5") {
        return Math.floor(floor.built_area / 1.80);
    }
    else if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 4).toUpperCase() == "MER1") {
        return Math.floor(floor.built_area / 3);
    }
    else if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 4).toUpperCase() == "MER2") {
        return Math.floor(floor.built_area / 6);
    }
    else if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 4).toUpperCase() == "MER3") {
        return Math.floor(floor.built_area / 20);
    }
    else if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 3).toUpperCase() == "BIZ") {
        return Math.floor(floor.built_area / 10);
    }
    else if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 3).toUpperCase() == "IND") {
        return Math.floor(floor.built_area / 10);
    }
    else if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 3).toUpperCase() == "STO") {
        return Math.floor(floor.built_area / 30);
    }
    else if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 3).toUpperCase() == "HAZ") {
        return Math.floor(floor.built_area / 10);
    }
    else if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 3).toUpperCase() == "PAR") {
        // return Math.floor(floor.built_area / 30);
        return 0;
    }
    else {
        return 0;
    }
}

function Common_LoadPerUnitExit(floor) {
    if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 3).toUpperCase() == "RES") {
        return 25;
    }
    else if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 3).toUpperCase() == "EDU") {
        return 25;
    }
    else if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 4).toUpperCase() == "INS1") {
        return 25;
    }
    else if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 4).toUpperCase() == "INS2") {
        return 25;
    }
    else if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 4).toUpperCase() == "ASM1") {
        return 40;
    }
    else if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 4).toUpperCase() == "ASM2") {
        return 40;
    }
    else if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 4).toUpperCase() == "MER1") {
        return 50;
    }
    else if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 4).toUpperCase() == "MER2") {
        return 50;
    }
    else if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 3).toUpperCase() == "BIZ") {
        return 50;
    }
    else if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 3).toUpperCase() == "IND") {
        return 50;
    }
    else if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 3).toUpperCase() == "STO") {
        return 50;
    }
    else if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 3).toUpperCase() == "HAZ") {
        return 25;
    }
    else {
        return 0;
    }
}

function Common_StairsbyLoad(floor) {
    if (floor.flr_type == 'F' || floor.flr_type == 'G') {
        //return Math.floor(100 * floor.occ_c_app / (2 * Common_LoadPerUnitExit(floor))) / 100;
        var stairwidth = 0; var occ_type = floor.occ_type;
        if (occ_type.length >= 3) {
            occ_type = occ_type.substring(0, 3).toUpperCase();
        }

        if (occ_type == "RES" || occ_type == "EDU" || occ_type == "ASM" || occ_type == "MER" || occ_type == "BIZ" || occ_type == "IND" || occ_type == "STO") {
            stairwidth = 10;
        }
        else if (occ_type.length >= 4 && occ_type.substring(0, 3).toUpperCase() == "INS") {
            stairwidth = 15;
        }
        else if (occ_type.length >= 3 && occ_type.substring(0, 3).toUpperCase() == "HAZ") {
            stairwidth = 18;
        }
        else {
            return 0;
        }
        if (stairwidth > 0) {
            var dbl = floor.occ_c_app * stairwidth;
            return Math.floor(dbl / 1000);
        }
    }
    return "";
}

function Common_MaxStairsbyLoad(block) {
    var maxVal = 0;
    var hasStilt = false;
    var flrCount = 0;
    for (var i in block.floors) {
        if (block.floors[i].flr_type == 'S') {
            hasStilt = true;
        }
        if (block.floors[i].flr_type == 'G' || block.floors[i].flr_type == 'F') {
            flrCount = flrCount + 1;
        }
    }

    if (flrCount > 1 || (flrCount == 1 && hasStilt)) {
        for (var i in block.floors) {
            var tmp = 0;
            if (block.floors[i].flr_type == 'F' || (block.floors[i].flr_type == 'G' && hasStilt)) {
                tmp = Common_StairsbyLoad(block.floors[i]);
            }
            if (tmp > maxVal)
                maxVal = tmp;
        }
    }
    return maxVal;
}

function Common_Maximum_Floor_Area(block, incl_b_s) {
    var maxVal = 0;
    for (var i in block.floors) {
        if (block.floors[i].flr_type == 'F' || block.floors[i].flr_type == 'G') {
            if (block.floors[i].built_area > maxVal)
                maxVal = block.floors[i].built_area;
        }
        else if (incl_b_s) {
            if (block.floors[i].built_area > maxVal)
                maxVal = block.floors[i].built_area;
        }
    }
    return maxVal;
}

function Common_TotalStairsRequiredByNBC(block) {
    var hasStilt = false;
    var flrCount = 0;
    for (var i in block.floors) {
        if (block.floors[i].flr_type == 'S') {
            hasStilt = true;
        }
        if (block.floors[i].flr_type == 'G' || block.floors[i].flr_type == 'F') {
            flrCount = flrCount + 1;
        }
    }

    if (flrCount > 1 || (flrCount == 1 && hasStilt)) {
        var maxVal = Common_Maximum_Floor_Area(block, false);
        if (maxVal <= 500) {
            return 1;
        }
        else {
            return 2;
        }
    }
    else {
        return 0;
    }
}

function Common_Front_Abutting(block) {
    retVal = 0;
    for (var i in block.sides) {
        if (block.sides[i].direc == block.front_dir)
            retVal = block.sides[i].width;
        //if (block.sides[i].width > retVal)
        //    retVal = block.sides[i].width;
    }
    return retVal;
}

function Common_NonMSB_Reqd_Open_Space(block, direc, area) {
    var reqd = -1; var check_height;
    var minabtwidth = false;
    //reqd = Math.ceil(block.permissible_height / 3);
    if (block.type == "P" || (block.type == "O" && block.occu_mode != "N")) {
        check_height = block.permissible_height;
    }
    else {
        check_height = block.height;
    }
    if (block.front_dir == "" || direc == block.front_dir) {
        var abutting = Common_Front_Abutting(block);
        if (check_height > 15 && check_height < 18 && area >= 1000) { minabtwidth = true; }
        if (area <= 200) {
            if (abutting <= 12) { reqd = 1.5; }
            else if (abutting <= 18) { reqd = 1.5; }
            else if (abutting <= 24) { reqd = 3; }
            else if (abutting <= 30) { reqd = 3; }
            else if (abutting > 30) { reqd = 3; }
        }
        else if (area > 200 && area <= 300) {
            if (check_height <= 7) {
                if (abutting <= 12) { reqd = 2; }
                else if (abutting <= 18) { reqd = 3; }
                else if (abutting <= 24) { reqd = 3; }
                else if (abutting <= 30) { reqd = 4; }
                else if (abutting > 30) { reqd = 5; }
            }
            else if (check_height > 7 && check_height <= 10) {
                if (abutting <= 12) { reqd = 2; }
                else if (abutting <= 18) { reqd = 3; }
                else if (abutting <= 24) { reqd = 3; }
                else if (abutting <= 30) { reqd = 5; }
                else if (abutting > 30) { reqd = 6; }
            }
            else { req = -1; }
        }
        else if (area > 300 && area <= 500) {
            if (check_height <= 12) {
                if (abutting <= 12) { reqd = 3; }
                else if (abutting <= 18) { reqd = 4; }
                else if (abutting <= 24) { reqd = 5; }
                else if (abutting <= 30) { reqd = 6; }
                else if (abutting > 30) { reqd = 7.5; }
            }
            else { req = -1; }
        }
        else if (area > 500 && area <= 1000) {
            if (check_height <= 15) {
                if (abutting <= 12) { reqd = 3; }
                else if (abutting <= 18) { reqd = 4; }
                else if (abutting <= 24) { reqd = 5; }
                else if (abutting <= 30) { reqd = 6; }
                else if (abutting > 30) { reqd = 7.5; }
            }
            else { req = -1; }
        }
        else if (area > 1000 && area <= 1500) {
            if (check_height <= 18) {
                if (abutting <= 12) { reqd = 3; }
                else if (abutting <= 18) { reqd = 4; }
                else if (abutting <= 24) { reqd = 5; }
                else if (abutting <= 30) { reqd = 6; }
                else if (abutting > 30) { reqd = 7.5; }
            }
            else { req = -1; }
        }
        else if (area > 1500 && area <= 2500) {
            if (check_height <= 18) {
                if (abutting <= 12) { reqd = 3; }
                else if (abutting <= 18) { reqd = 4; }
                else if (abutting <= 24) { reqd = 5; }
                else if (abutting <= 30) { reqd = 6; }
                else if (abutting > 30) { reqd = 7.5; }
            }
            else { req = -1; }
        }
        else if (area > 2500) {
            if (check_height <= 18) {
                if (abutting <= 12) { reqd = 3; }
                else if (abutting <= 18) { reqd = 4; }
                else if (abutting <= 24) { reqd = 5; }
                else if (abutting <= 30) { reqd = 6; }
                else if (abutting > 30) { reqd = 7.5; }
            }
            else { req = -1; }
        }
    }
    else {
        if (area > 0) {
            if (area <= 50) {
                if (check_height <= 7) reqd = 0;
            }
            else if (area > 50 && area <= 100) {
                if (check_height <= 7) reqd = 0;
                else if (check_height <= 10) reqd = 0.5;
                else req = -1;
            }
            else if (area > 100 && area <= 200) {
                if (check_height <= 10) reqd = 1;
                else req = -1;
            }
            else if (area > 200 && area <= 300) {
                if (check_height <= 7) reqd = 1;
                else if (check_height <= 10) reqd = 1.5;
                else req = -1;
            }
            else if (area > 300 && area <= 400) {
                if (check_height <= 7) reqd = 1.5;
                else if (check_height <= 12) reqd = 2;
                else reqd = -1;
            }
            else if (area > 400 && area <= 500) {
                if (check_height <= 7) reqd = 2;
                else if (check_height <= 12) reqd = 2.5;
                else reqd = -1;
            }
            else if (area > 500 && area <= 750) {
                if (check_height <= 7) reqd = 2.5;
                else if (check_height <= 12) reqd = 3;
                else if (check_height <= 15) reqd = 3.5;
                else reqd = -1;
            }
            else if (area > 750 && area <= 1000) {
                if (check_height <= 7) reqd = 3;
                else if (check_height <= 12) reqd = 3.5;
                else if (check_height <= 15) reqd = 4;
                else reqd = -1;
            }
            else if (area > 1000 && area <= 1500) {
                if (minabtwidth) {
                    if (abutting >= 12) {
                        if (check_height <= 7) reqd = 3.5;
                        else if (check_height <= 12) reqd = 4;
                        else if (check_height <= 15) reqd = 5;
                        else if (check_height <= 18) reqd = 6;
                        else reqd = -1;
                    }
                    else {
                        reqd = -2;
                    }
                }
                else {
                    if (check_height <= 7) reqd = 3.5;
                    else if (check_height <= 12) reqd = 4;
                    else if (check_height <= 15) reqd = 5;
                    else if (check_height <= 18) reqd = 6;
                    else reqd = -1;
                }
            }
            else if (area > 1500 && area <= 2500) {
                if (minabtwidth) {
                    if (abutting >= 12) {
                        if (check_height <= 7) reqd = 4;
                        else if (check_height <= 15) reqd = 5;
                        else if (check_height <= 18) reqd = 6;
                        else reqd = -1;
                    }
                    else {
                        reqd = -2;
                    }
                }
                else {
                    if (check_height <= 7) reqd = 4;
                    else if (check_height <= 15) reqd = 5;
                    else if (check_height <= 18) reqd = 6;
                }
            }
            else if (area > 2500) {
                if (minabtwidth) {
                    if (abutting >= 12) {
                        if (check_height <= 7) reqd = 5;
                        else if (check_height <= 15) reqd = 6;
                        else if (check_height <= 18) reqd = 7;
                        else reqd = -1;
                    }
                    else {
                        reqd = -2;
                    }
                }
                else {
                    if (check_height <= 7) reqd = 5;
                    else if (check_height <= 15) reqd = 6;
                    else if (check_height <= 18) reqd = 7;
                }
            }
        }
    }
    return reqd;
}

function Common_proposed_open_space(block, direc) {
    for (i in block.ospaces) {
        if (block.ospaces[i].direc == direc) {
            return block.ospaces[i].proposed;
        }
    }
    return 0;
}

function Common_reqd_open_space(block, direc, plota) {
    var reqd = 7;
    var area = 0;
    area = typeof plota !== 'undefined' ? plota : 0;
    var check_height = 0.0;
    if (block.type == "P" || (block.type == "O" && block.occu_mode != "N")) {
        check_height = block.permissible_height;
    }
    else {
        check_height = block.height;
    }

    if (block.is_multiplex == false || block.is_miniplex == false) {
        if (block.block_type == 'T') {
            reqd = 3;
        }
        else if (block.block_type == 'P') {
            reqd = 7;
        }
        else if (check_height < 18) {
            reqd = Common_NonMSB_Reqd_Open_Space(block, direc, area);
        }
        else {
            //height to permissible_height as per G.O.MS119   
            if (check_height >= 18 && check_height <= 21) {
                reqd = 7;
            }
            else if (check_height > 21 && check_height <= 24) {
                reqd = 8;
            }
            else if (check_height > 24 && check_height <= 27) {
                reqd = 9;
            }
            else if (check_height > 27 && check_height <= 30) {
                reqd = 10;
            }
            else if (check_height > 30 && check_height <= 35) {
                reqd = 11;
            }
            else if (check_height > 35 && check_height <= 40) {
                reqd = 12;
            }
            else if (check_height > 40 && check_height <= 45) {
                reqd = 13;
            }
            else if (check_height > 45 && check_height <= 50) {
                reqd = 14;
            }
            else if (check_height > 50 && check_height <= 55) {
                reqd = 16;
            }
            else {
                reqd = 16 + (Math.ceil((((check_height - 55) / 5) * 0.5) * 2) / 2);
            }
        }
        if (block.road_wide) {
            var roadwidening = block.roadwidening;
            for (var i = 0; i < roadwidening.length; i++) {
                var rwdirection = roadwidening[i].rw_direc;
                if (rwdirection == direc) {
                    reqd = roadwidening[i].rw_reqd;
                    break;
                }
            }


            //if (check_height >= 18) {
            //    if (direc != "") {
            //        if (block.front_dir == "" || direc == block.front_dir) {
            //            return reqd;
            //        }
            //        else {
            //            if (check_height >= 18 && check_height <= 70)
            //                return 7;
            //            else if (check_height > 70 && check_height <= 90)
            //                return 9;
            //            else if (check_height > 90 && check_height <= 120)
            //                return 12;
            //            else if (check_height > 120)
            //                return 16;
            //        }
            //    }
            //    else {
            //        return reqd;
            //    }
            //}
            //else if (check_height >= 18 && check_height <= 21) {
            //    if (block.front_dir == "" || direc == block.front_dir) {
            //        return reqd;
            //    }
            //    else {
            //        return 3;
            //    }
            //}
            //else if (check_height >= 18 && check_height <= 21) {
            //    if (block.front_dir == "" || direc == block.front_dir) {
            //        return reqd;
            //    }
            //    else {
            //        return 2.5;
            //    }
            //}
            //else {
            //    if (block.front_dir == "" || direc == block.front_dir) {
            //        return reqd;
            //    }
            //    else {
            //        return 2;
            //    }
            //}
        }
    }
    if (block.is_multiplex == true) {
        if (block.height <= 40) {
            reqd = 12;
            if (direc != "") {
                if (block.front_dir == "" || direc == block.front_dir) {
                    return reqd;
                }
                else {
                    if (block.height <= 15) {
                        return 6;
                    }
                    else if (block.height > 15 && block.height <= 21) {
                        return 7;
                    }
                    else if (block.height > 21 && block.height <= 24) {
                        return 8;
                    }
                    else if (block.height > 24 && block.height <= 27) {
                        return 9;
                    }
                    else if (block.height > 27 && block.height <= 30) {
                        return 10;
                    }
                    else if (block.height > 30 && block.height <= 35) {
                        return 11;
                    }
                    else if (block.height > 35 && block.height <= 40) {
                        return 12;
                    }
                }
            }
            else {
                return reqd;
            }
        }
        else if (block.height > 40 && block.height <= 45) {
            reqd = 13;
            if (block.front_dir == "" || direc == block.front_dir) {
                return reqd;
            }
            else {
                return 13;
            }
        }
        else if (block.height > 45 && block.height <= 50) {
            reqd = 14;
            if (block.front_dir == "" || direc == block.front_dir) {
                return reqd;
            }
            else {
                return 14;
            }
        }
        else if (block.height > 50) {
            reqd = 15;
            if (block.front_dir == "" || direc == block.front_dir) {
                return reqd;
            }
            else {
                return 16;
            }
        }
    }
    else if (block.is_miniplex == true) {
        return 3;
    }
    else {
        return reqd;
    }
}


////not using
//function Common_Maximum_Travel_Distance(block)
//{
//    var retVal = 30;
//    if ( block.site_type == "ind")
//    {
//        retVal = 45;
//    }
//    else if ( block.site_type == "haz" )
//    {
//        retVal = 22.5;
//    }
//    return retVal;
//}

//function Common_Maximum_Travel_Distance_DeadEnd(block) {
//    var retVal = 15;
//    if (block.site_type == "asm") {
//        retVal = 6;
//    }
//    return retVal;
//}

function Common_Fire_Lifts_Reqd(block) {
    if (block.height >= 15) {
        var maxVal = Common_Maximum_Floor_Area(block, false);
        return Math.round(maxVal / 1200);
    }
    else {
        return 0;
    }
}

function Common_Block_TotalOccLoad(block) {
    var floor; var total = 0.0;
    for (floor in block.floors) {
        total = total + parseFloat(block.floors[floor].occ_c_app);
    }
    return Math.round(total * 100) / 100;
}

function Common_Block_TotalNBCOccLoad(block) {
    var floor; var total = 0.0;
    for (floor in block.floors) {
        total = total + Math.round(Common_t20OccCount(block.floors[floor]));
    }
    return Math.round(total * 100) / 100;
}

function Common_Block_Built_Up(block) {
    var floor; var total = 0.0;
    for (floor in block.floors) {
        total = total + parseFloat(block.floors[floor].built_area);
    }
    return Math.round(total * 100) / 100;
}

function Common_Floor_Type_Name(type) {
    if (type == "B") return "Basement / Cellar";
    else if (type == "S") return "Stilt";
    else if (type == "G") return "Ground";
    else if (type == "F") return "Floor";
    else if (type == "T") return "Terrace";
    else return type;
}


function Common_Floor_Occu_Name(occu) {
    if (occu == "PAR") return "Parking";
    else if (occu == "RES") return "Residential";
    else if (occu == "EDU1") return "Educational";
    else if (occu == "EDU2") return "Educational - Engineering and Technology";
    else if (occu == "INS1") return "Institutional without Dormitory";
    else if (occu == "INS2") return "Institutional with Dormitory";
    else if (occu == "ASM1") return "Assembly with fixed seats";
    else if (occu == "ASM2") return "Assembly without seating facility";
    else if (occu == "ASM3") return "Concentrated use without fixed seating";
    else if (occu == "ASM4") return "Less concentrated use without fixed seating";
    else if (occu == "ASM5") return "Dining areas & restaurants with seating & table";
    else if (occu == "ASM6") return "Assembly - Mixed";
    else if (occu == "MER1") return "Mercantile - Street floor and Sale Basement";
    else if (occu == "MER2") return "Mercantile - Upper Sale floors";
    else if (occu == "MER3") return "Mercantile - Storage / Warehouse";
    else if (occu == "BIZ") return "Business";
    else if (occu == "IND") return "Industrial";
    else if (occu == "STO") return "Storage";
    else if (occu == "MLCP") return "Storage - Multilevel Car parking";
    else if (occu == "HAZ") return "Hazardous";
    else if (occu == "OTH") return "Other Non-Occupanices";
    else return occu;
}

function Common_FloorDisplay(block) {
    var bc = 0; var sc = 0; var gc = 0; var fc = 0; var tc = 0;
    for (var i in block.floors) {
        if (block.floors[i].built_area > 0) {
            if (block.floors[i].flr_type == 'F') fc = fc + 1;
            else if (block.floors[i].flr_type == 'G') gc = gc + 1;
            else if (block.floors[i].flr_type == 'B') bc = bc + 1;
            else if (block.floors[i].flr_type == 'S') sc = sc + 1;
            else if (block.floors[i].flr_type == 'T') tc = tc + 1;
        }
    }

    var retval = "";
    if (bc == 1) retval = retval + "Basement ";
    else if (bc > 1) retval = retval + bc + " Basements ";

    if (retval != "" && sc > 0) retval = retval + "+ ";
    if (sc == 1) retval = retval + "Stilt ";
    else if (sc > 1) retval = retval + sc + " Stilts ";

    if (retval != "" && gc > 0) retval = retval + "+ ";
    if (gc == 1) retval = retval + "Ground Floor ";
    else if (gc > 1) retval = retval + gc + " Ground Floors ";

    if (retval != "" && fc > 0) retval = retval + "+ ";
    if (fc == 1) retval = retval + "One Upper Floor ";
    else if (fc > 1) retval = retval + fc + " Upper Floors ";

    //	    if (retval != "" && tc > 0) retval = retval + "+ ";
    //	    if (tc == 1) retval = retval + "Terrace ";
    //	    else if (tc > 1) retval = retval + tc + " Terraces ";

    return retval;
}

function Common_Direction_Name(direc) {
    if (direc == 'E') return 'East';
    else if (direc == 'W') return 'West';
    else if (direc == 'N') return 'North';
    else if (direc == 'S') return 'South';
    else if (direc == 'NE') return 'North East';
    else if (direc == 'NW') return 'North West';
    else if (direc == 'SE') return 'South East';
    else if (direc == 'SW') return 'South West';
    else if (direc == 'C') return 'Center';
    else return direc;
}

function Common_Required_Equip(block, id) {
    for (var i in block.equipment) {
        if (block.equipment[i].qtype == id) {
            return block.equipment[i].count;
        }
    }
    return "-";
}

function Common_Stair_Count(block, type) {
    var hasStilt = false;
    var flrCount = 0;
    for (var i in block.floors) {
        if (block.floors[i].flr_type == 'S') {
            hasStilt = true;
        }
        if (block.floors[i].flr_type == 'G' || block.floors[i].flr_type == 'F') {
            flrCount = flrCount + 1;
        }
    }
    if (flrCount > 1 || (flrCount == 1 && hasStilt)) {
        return 1;
    }
    else {
        return 0;
    }
}

function Common_t20OccCount_O(floor) {
    if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 3).toUpperCase() == "RES") {
        return Math.floor(floor.parent_built_area / 12.5);
    }
    else if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 4).toUpperCase() == "EDU1") {
        return Math.floor(floor.parent_built_area / 4);
    }
    else if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 4).toUpperCase() == "EDU2") {
        return Math.floor(floor.parent_built_area / 12.5);
    }
    else if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 4).toUpperCase() == "INS1") {
        return Math.floor(floor.parent_built_area / 10);
    }
    else if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 4).toUpperCase() == "INS2") {
        return Math.floor(floor.parent_built_area / 15);
    }
    else if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 4).toUpperCase() == "ASM1") {
        return Math.floor(floor.parent_built_area / 0.65);
    }
    else if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 4).toUpperCase() == "ASM2") {
        return Math.floor(floor.parent_built_area / 1.2);
    }
    else if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 4).toUpperCase() == "ASM3") {
        return Math.floor(floor.parent_built_area / 0.65);
    }
    else if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 4).toUpperCase() == "ASM4") {
        return Math.floor(floor.parent_built_area / 1.40);
    }
    else if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 4).toUpperCase() == "ASM5") {
        return Math.floor(floor.parent_built_area / 1.80);
    }
    else if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 4).toUpperCase() == "MER1") {
        return Math.floor(floor.parent_built_area / 3);
    }
    else if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 4).toUpperCase() == "MER2") {
        return Math.floor(floor.parent_built_area / 6);
    }
    else if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 4).toUpperCase() == "MER3") {
        return Math.floor(floor.parent_built_area / 20);
    }
    else if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 3).toUpperCase() == "BIZ") {
        return Math.floor(floor.parent_built_area / 10);
    }
    else if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 3).toUpperCase() == "IND") {
        return Math.floor(floor.parent_built_area / 10);
    }
    else if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 3).toUpperCase() == "STO") {
        return Math.floor(floor.parent_built_area / 30);
    }
    else if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 3).toUpperCase() == "HAZ") {
        return Math.floor(floor.parent_built_area / 10);
    }
    else {
        return 0;
    }
}

function Common_Block_Built_Up_O(block) {
    var floor; var total = 0.0;
    for (floor in block.floors) {
        total = total + parseFloat(block.floors[floor].parent_built_area);
    }
    return Math.round(total * 100) / 100;
}

function Common_Block_TotalOccLoad_O(block) {
    var floor; var total = 0.0;
    for (floor in block.floors) {
        total = total + parseFloat(block.floors[floor].parent_occ_c_app);
    }
    return Math.round(total * 100) / 100;
}

function Common_Block_TotalNBCOccLoad_O(block) {
    var floor; var total = 0.0;
    for (floor in block.floors) {
        total = total + Math.round(Common_t20OccCount_O(block.floors[floor]));
    }
    return Math.round(total * 100) / 100;
}

function Common_proposed_open_space_O(block, direc) {
    for (i in block.ospaces) {
        if (block.ospaces[i].direc == direc) {
            return block.ospaces[i].parent_proposed;
        }
    }
    return 0;
}

function Common_reqd_escape_width(stype, site_type, site_stype, max_ocount, nbc_year) {
    if (nbc_year == "2016") {
        if (stype.toUpperCase() == "I") {
            if (site_type.toUpperCase() == "INS") {
                return "2.0";
            }
            else if (site_type.toUpperCase() == "RES") {
                if (site_stype.toUpperCase() == "A2") { return "1.0"; }
                else if (site_stype.toUpperCase() == "A1" || site_stype.toUpperCase() == "A3" || site_stype.toUpperCase() == "A4") { return "1.25"; }
                else if (site_stype.toUpperCase() == "A5" || site_stype.toUpperCase() == "A6") { return "1.5"; }
            }
            else if (site_type.toUpperCase() == "ASM") {
                if (max_ocount < 150) {
                    return "1.5";
                }
                else {
                    return "2.0";
                }
            }
            else
                return "1.5";
        } else if (stype == "E") {
            return "1.5";
        } else if (stype == "R") {
            return "2.0";
        } else if (stype == "C") {
            return "1-Way: 3.6 / 2-Way:5.4";
        } else {
            return "0";
        }
    }
    else {
        if (stype == 'I') {
            if (site_type == 'ins' || site_type == 'asm')
                return "2.0";
            else
                return "1.5";
        } else if (stype == 'E') {
            return "1.25";
        } else if (stype == 'R') {
            return "2.0";
        } else if (stype == 'C') {
            return "1-Way: 3.6 / 2-Way:5.4";
        } else {
            return "NA";
        }
    }
}

function Common_DoorWidthRequired(block) {
    if (block.site_type == 'asm') {
        return 2;
    }
    else {
        return 1;
    }
}

function Common_Stair_Type_Name(type) {
    if (type == "I") return "Internal Staircase";
    else if (type == "E") return "External Staircase";
    else if (type == "R") return "Ramp (above Ground)";
    else if (type == "C") return "Basement Ramp";
    else return type;
}

function Common_FloorDesc(block, floor_id) {
    var rtvalue = "";
    for (var i in block.floors) {
        if (block.floors[i].floor_id == floor_id) {
            rtvalue = block.floors[i].flr_name;
        }
    }
    return rtvalue;
}